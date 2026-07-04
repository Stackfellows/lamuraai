import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { generateAiReply } from './aiService.js';
import { io } from '../server.js';
import fs from 'fs';
import path from 'path';
import { User } from '../models/User.js';
import { WhatsAppContact } from '../models/WhatsAppContact.js';

export interface Contact {
  jid: string;
  number: string;
  name?: string;
  lastMessageTime: number;
}

// User-specific socket storage
export const userSockets = new Map<string, any>();

export const clearWhatsAppSession = async (userId: string) => {
  const sock = userSockets.get(userId);
  if (sock) {
    try {
      await sock.logout();
    } catch (err) {
      console.error('Error logging out sock:', err);
    }
    userSockets.delete(userId);
  }
  
  const authFolder = `auth_info_baileys_${userId}`;
  if (fs.existsSync(authFolder)) {
    try {
      fs.rmSync(authFolder, { recursive: true, force: true });
      console.log(`Successfully cleared session data for user ${userId}.`);
    } catch (err) {
      console.error(`Failed to remove folder for user ${userId}:`, err);
    }
  }

  await User.findByIdAndUpdate(userId, { $unset: { whatsappNumber: 1 } });
  io.to(userId).emit('whatsapp_disconnected');
  
  return true;
};

export const userRecentContacts = new Map<string, Map<string, Contact>>();
export const userQRs = new Map<string, string>(); // Cache QR codes
const pendingReplies = new Map<string, NodeJS.Timeout>();
const lastAutoReplyTime = new Map<string, number>();

export const sendWhatsAppMessage = async (userId: string, to: string, message: string) => {
  const sock = userSockets.get(userId);
  if (!sock) throw new Error('WhatsApp is not connected for this user');
  
  let jid = to;
  if (!to.includes('@')) {
    jid = `${to}@s.whatsapp.net`;
  }
  await sock.sendMessage(jid, { text: message });
};

const userPhonebooks = new Map<string, Map<string, string>>();

export const connectToWhatsApp = async (userId: string) => {
  if (userSockets.has(userId)) {
    console.log(`WhatsApp socket already exists for user ${userId}`);
    // If we have a cached QR, emit it immediately
    if (userQRs.has(userId)) {
      io.to(userId).emit('whatsapp_qr', userQRs.get(userId));
    } else {
      io.to(userId).emit('whatsapp_connected');
    }
    return;
  }

  const authFolder = `auth_info_baileys_${userId}`;
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  
  let version: [number, number, number] = [2, 3000, 1015901307];
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
  } catch (e) {
    console.log('Failed to fetch baileys version, using fallback');
  }
  
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    connectTimeoutMs: 60000,
  });
  
  userSockets.set(userId, sock);
  if (!userRecentContacts.has(userId)) {
    userRecentContacts.set(userId, new Map<string, Contact>());
  }
  if (!userPhonebooks.has(userId)) {
    userPhonebooks.set(userId, new Map<string, string>());
  }

  sock.ev.on('contacts.upsert', (contacts) => {
    const phonebook = userPhonebooks.get(userId);
    if (phonebook) {
      for (const c of contacts) {
        if (c.name && c.id) {
          phonebook.set(c.id, c.name);
        }
      }
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      userQRs.set(userId, qr);
      // Emit QR to specific user's frontend socket room
      io.to(userId).emit('whatsapp_qr', qr);
    }
    
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`WhatsApp connection closed for ${userId}, reconnecting ${shouldReconnect}`);
      userSockets.delete(userId);
      userQRs.delete(userId);
      if (shouldReconnect) {
        setTimeout(() => {
          connectToWhatsApp(userId);
        }, 5000);
      } else {
        // Logged out - remove auth folder and remove whatsapp number from user
        try {
          fs.rmSync(authFolder, { recursive: true, force: true });
          User.findByIdAndUpdate(userId, { $unset: { whatsappNumber: 1 } }).catch(console.error);
        } catch (e) {}
      }
    } else if (connection === 'open') {
      console.log(`✅ WhatsApp connected successfully for user ${userId}!`);
      userQRs.delete(userId);
      io.to(userId).emit('whatsapp_connected');
      
      // Save whatsapp number to database
      if (sock.user && sock.user.id) {
        const number = sock.user.id.split(':')[0];
        User.findByIdAndUpdate(userId, { whatsappNumber: number }).catch(console.error);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Listen to incoming messages for this user's socket
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    let remoteJid = msg.key.remoteJid;
    if (!remoteJid) return;

    if (remoteJid.endsWith('@lid') && msg.key.remoteJidAlt) {
      remoteJid = msg.key.remoteJidAlt;
    }

    const replyKey = `${userId}_${remoteJid}`;

    if (msg.key.fromMe) {
      if (pendingReplies.has(replyKey)) {
        clearTimeout(pendingReplies.get(replyKey));
        pendingReplies.delete(replyKey);
        console.log(`Cancelled AI reply for ${replyKey} because user replied manually.`);
      }
      lastAutoReplyTime.set(replyKey, Date.now());
      return;
    }

    if (m.type === 'notify') {
      let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      
      if (!text && msg.message?.ephemeralMessage?.message) {
        const ephMsg = msg.message.ephemeralMessage.message;
        text = ephMsg.conversation || ephMsg.extendedTextMessage?.text;
      }
      
      if (remoteJid && (
        remoteJid.endsWith('@g.us') || 
        remoteJid === 'status@broadcast' || 
        remoteJid.endsWith('@broadcast') ||
        remoteJid.endsWith('@newsletter') ||
        remoteJid.length > 20 // Ignore weird long IDs
      )) return;
      
      if (remoteJid) {
        const number = remoteJid.split('@')[0];
        const contactsMap = userRecentContacts.get(userId);
        const existingContact = contactsMap?.get(remoteJid);
        const savedPhonebookName = userPhonebooks.get(userId)?.get(remoteJid);
        
        let contactName = savedPhonebookName || msg.pushName || existingContact?.name || number;
        
        contactsMap?.set(remoteJid, {
          jid: remoteJid,
          number: number,
          name: contactName,
          lastMessageTime: Date.now()
        });

        // Persist to database so it survives refresh/restarts
        WhatsAppContact.findOneAndUpdate(
          { user: userId, jid: remoteJid },
          { number: number, name: contactName, lastMessageTime: Date.now() },
          { upsert: true, new: true }
        ).catch(console.error);
      }

      if (text && remoteJid && remoteJid.endsWith('@s.whatsapp.net')) {
        text = text.trim();
        
        const userObj = await User.findById(userId);

        const lastReply = lastAutoReplyTime.get(replyKey);
        const now = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;
        
        // If not business mode, apply the 1-hour rate limit between auto-replies
        if (userObj?.aiUsageType !== 'business') {
          if (lastReply && (now - lastReply < ONE_HOUR)) return;
        }

        let delayMs = 10000; // default
        if (userObj?.aiUsageType === 'personal') {
          delayMs = 60000; // 1 minute
        } else if (userObj?.aiUsageType === 'business') {
          delayMs = 0; // immediate
        }

        const timeoutId = setTimeout(async () => {
          pendingReplies.delete(replyKey);
          try {
            const replyText = await generateAiReply(text as string, userObj);
            await sock.sendMessage(remoteJid as string, { text: replyText });
            lastAutoReplyTime.set(replyKey, Date.now()); 
            io.to(userId).emit('new_message', { from: remoteJid, text, reply: replyText });
          } catch (err) {
            console.error('❌ Failed to send AI reply', err);
          }
        }, delayMs);
        
        pendingReplies.set(replyKey, timeoutId);
      }
    }
  });
};

export const initializeAllWhatsAppConnections = async () => {
  try {
    const usersWithWhatsApp = await User.find({ whatsappNumber: { $exists: true, $ne: null } });
    console.log(`Found ${usersWithWhatsApp.length} users with registered WhatsApp numbers. Initializing sessions...`);
    for (const user of usersWithWhatsApp) {
      // Connect in background to keep sessions active
      connectToWhatsApp(user._id.toString()).catch(err => {
        console.error(`Failed to initialize WhatsApp for user ${user._id}`, err);
      });
    }
  } catch (err) {
    console.error('Failed to initialize background WhatsApp connections:', err);
  }
};
