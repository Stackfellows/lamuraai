import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { sendWhatsAppMessage, userSockets, userRecentContacts } from '../services/whatsappService.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

import { WhatsAppContact } from '../models/WhatsAppContact.js';

export const getContacts = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user.id;
  
  // Fetch from database to ensure persistence across reloads
  const contacts = await WhatsAppContact.find({ user: userId })
    .sort({ lastMessageTime: -1 })
    .limit(50); // get recent 50
    
  if (!contacts || contacts.length === 0) {
    return res.json([]);
  }
  
  const formattedContacts = contacts
    .filter(c => !(
      c.jid.endsWith('@g.us') || 
      c.jid === 'status@broadcast' || 
      c.jid.endsWith('@broadcast') || 
      c.jid.endsWith('@newsletter') || 
      c.jid.length > 20
    ))
    .map(c => ({
      jid: c.jid,
      number: c.number,
      name: c.name,
      lastMessageTime: c.lastMessageTime
    }));
  
  res.json(formattedContacts);
});

export const getStatus = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user.id;
  const { userSockets, userQRs } = await import('../services/whatsappService.js');
  const sock = userSockets.get(userId);
  const qr = userQRs.get(userId) || null;
  
  if (sock && sock.user) {
    const number = sock.user.id.split(':')[0];
    res.json({ connected: true, number, qr: null });
  } else {
    res.json({ connected: false, number: null, qr });
  }
});

export const sendMessage = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user.id;
  const { to, message } = req.body;
  if (!to || !message) {
    return next(new AppError('Phone number and message are required', 400));
  }
  
  if (!userSockets.has(userId)) {
    return next(new AppError('WhatsApp is not connected', 400));
  }
  
  await sendWhatsAppMessage(userId, to, message);
  res.json({ success: true, message: 'Message sent successfully via WhatsApp' });
});

export const clearSession = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user.id;
  const { clearWhatsAppSession } = await import('../services/whatsappService.js');
  
  await clearWhatsAppSession(userId);
  
  res.json({ success: true, message: 'WhatsApp session cleared successfully for security.' });
});
