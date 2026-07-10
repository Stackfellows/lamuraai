import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';
import nodemailer from 'nodemailer';

export const getSettings = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = await import('../models/User.js').then(m => m.User.findById(req.user.id));
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  res.json({
    emailAccount: user.emailAccount || '',
    emailAppPassword: user.emailAppPassword ? '********' : '',
    emailAutoResponderEnabled: user.emailAutoResponderEnabled || false
  });
});

export const updateSettings = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { emailAccount, emailAppPassword, emailAutoResponderEnabled } = req.body;
  
  const updateData: any = {};
  if (emailAccount !== undefined) updateData.emailAccount = emailAccount;
  if (emailAutoResponderEnabled !== undefined) updateData.emailAutoResponderEnabled = emailAutoResponderEnabled;
  if (emailAppPassword !== undefined && emailAppPassword !== '********' && emailAppPassword !== '') {
    updateData.emailAppPassword = emailAppPassword;
  }
  
  const user = await import('../models/User.js').then(m => m.User.findByIdAndUpdate(
    req.user.id,
    updateData,
    { new: true, runValidators: true }
  ));
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  res.json({
    emailAccount: user.emailAccount || '',
    emailAppPassword: user.emailAppPassword ? '********' : '',
    emailAutoResponderEnabled: user.emailAutoResponderEnabled || false
  });
});

export const sendEmail = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { to, subject, message } = req.body;
  
  if (!to || !subject || !message) {
    return next(new AppError('Please provide to, subject, and message.', 400));
  }

  const user = await import('../models/User.js').then(m => m.User.findById(req.user.id));
  if (!user || !user.emailAccount || !user.emailAppPassword) {
    return next(new AppError('Email settings not configured. Please go to Settings and configure your Gmail account first.', 400));
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: user.emailAccount,
      pass: user.emailAppPassword,
    },
  });

  const mailOptions = {
    from: user.emailAccount,
    to,
    subject,
    text: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Nodemailer Error:', error);
    return next(new AppError('Failed to send email. Ensure your App Password is correct.', 500));
  }
});

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export const getInbox = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = await import('../models/User.js').then(m => m.User.findById(req.user.id));
  if (!user || !user.emailAccount || !user.emailAppPassword) {
    return next(new AppError('Email settings not configured. Please go to Settings and configure your Gmail account first.', 400));
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: user.emailAccount,
      pass: user.emailAppPassword
    },
    logger: false as any,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const parsedEmails = [];
    
    try {
      const totalMessages = typeof client.mailbox === 'boolean' ? 0 : client.mailbox.exists;
      if (totalMessages > 0) {
        // Limit to 5 most recent emails to prevent server timeout on large mailboxes
        const fetchCount = 5; 
        const start = Math.max(1, totalMessages - fetchCount + 1);
        for await (const message of client.fetch(`${start}:*`, { envelope: true, source: true })) {
          if (!message.source) continue;
          const parsed: any = await simpleParser(message.source);
          parsedEmails.push({
            id: message.uid,
            subject: parsed.subject || '(No Subject)',
            from: parsed.from?.text || 'Unknown',
            date: parsed.date || (message.envelope && message.envelope.date) || new Date(),
            text: parsed.text || parsed.textAsHtml || 'No content'
          });
        }
      }
    } finally {
      lock.release();
    }
    
    await client.logout();

    // Sort by date descending
    parsedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json(parsedEmails);

  } catch (error: any) {
    console.error('IMAP Error:', error);
    return next(new AppError(`IMAP Error: ${error.message || 'Failed to fetch inbox'}. Make sure IMAP is enabled.`, 500));
  }
});
