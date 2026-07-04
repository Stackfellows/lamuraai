import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { User } from '../models/User.js';
import { generateGroqCompletion } from './aiService.js';

export const processAutoResponder = async () => {
  console.log('[Email Cron] Starting Auto-Responder check...');
  
  try {
    // Find all users who have enabled the auto-responder and have credentials
    const users = await User.find({
      emailAutoResponderEnabled: true,
      emailAccount: { $exists: true, $ne: '' },
      emailAppPassword: { $exists: true, $ne: '' }
    });

    if (users.length === 0) {
      console.log('[Email Cron] No users with auto-responder enabled.');
      return;
    }

    for (const user of users) {
      console.log(`[Email Cron] Checking for user: ${user.emailAccount}`);
      try {
        await processUserEmails(user);
      } catch (err: any) {
        console.error(`[Email Cron] Error processing user ${user.emailAccount}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[Email Cron] Critical error in cron job:', err.message);
  }
};

const processUserEmails = async (user: any) => {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: user.emailAccount,
      pass: user.emailAppPassword
    },
    logger: false as any
  });

  client.on('error', (err: any) => {
    console.error('[Email Cron] IMAP connection error (non-fatal):', err.message);
  });

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');

  try {
    // Search for unseen emails properly
    const unseenUids = await client.search({ seen: false });
    
    if (unseenUids && unseenUids.length > 0) {
      // Limit to max 3 emails per run to avoid IMAP connection timeout & AI rate limits
      const limitedUids = unseenUids.slice(0, 3);
      console.log(`[Email Cron] Found ${unseenUids.length} unseen emails. Processing top ${limitedUids.length}...`);
      
      const searchIterator = client.fetch(limitedUids, { envelope: true, source: true, uid: true });
      
      for await (const message of searchIterator) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source);
        const subject = parsed.subject || '';
        const from = parsed.from?.text || '';
        const text = parsed.text || '';
        
        console.log(`[Email Cron] Processing unseen email from ${from} | Subject: ${subject}`);
        
        // AI Draft Reply directly for every email
        const userName = user.name || 'the user';
        const draftPrompt = `You are a highly intelligent and professional personal assistant for ${userName}.
A new email has been received. Your task is to READ the original email thoroughly and write a highly contextual, relevant, and appropriate reply on behalf of ${userName}.

CRITICAL RULES:
1. If the email is a promotional email, newsletter, or automated alert (like a project view notification), DO NOT repeat its contents. Just write a single short sentence like: "Thank you for the update, I have received this."
2. If the sender asked a question, answer it directly or state that you will look into it.
3. Reply in the EXACT SAME LANGUAGE as the original email.
4. DO NOT include "Subject:" or placeholders like [Your Name]. Just provide the final email body.
5. NEVER copy/paste the original email back to the sender.

Original Email From: ${from}
Original Email Subject: ${subject}
Original Email Body: ${text.substring(0, 2000)}

Provide ONLY the body of the reply email.`;

        const replyBody = await generateGroqCompletion([{ role: 'user', content: draftPrompt }]);
        
        // Send the Reply
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: user.emailAccount,
            pass: user.emailAppPassword,
          },
        });

        // Extract actual email address from parsed data
        const fromAddress = parsed.from?.value?.[0]?.address || '';
        
        if (!fromAddress) {
          console.error(`[Email Cron] Could not determine from address for email: ${subject}`);
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          continue;
        }

        // Prevent infinite loops / replying to daemons
        const lowerFrom = fromAddress.toLowerCase();
        if (lowerFrom.includes('noreply') || 
            lowerFrom.includes('no-reply') || 
            lowerFrom.includes('mailer-daemon') ||
            lowerFrom.includes('postmaster') ||
            lowerFrom.includes('bounce')) {
            console.log(`[Email Cron] Skipping automated/daemon email from: ${fromAddress}`);
            await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
            continue;
        }

        // Use Reply-To if available, otherwise From
        const replyTo = parsed.replyTo?.value?.[0]?.address || fromAddress;

        if (!replyTo) {
          console.error(`[Email Cron] Could not determine reply-to address from: ${from}`);
          // Mark as seen anyway to avoid infinite loop
          await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          continue;
        }

        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;

        await transporter.sendMail({
          from: user.emailAccount,
          to: replyTo,
          subject: replySubject,
          text: replyBody,
          inReplyTo: parsed.messageId,
          references: parsed.messageId ? [parsed.messageId] : undefined
        });
        
        console.log(`[Email Cron] Sent auto-reply to ${replyTo}`);

        // Mark as SEEN so it isn't processed again
        await client.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
        console.log(`[Email Cron] Marked email ${message.uid} as SEEN`);
      }
    } else {
      console.log(`[Email Cron] No new unseen emails for ${user.emailAccount}`);
    }

  } finally {
    lock.release();
  }

  await client.logout();
};
