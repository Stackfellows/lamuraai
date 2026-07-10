import { Response, NextFunction } from 'express';
import { Task } from '../models/Task.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

export const getTasks = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50; // default 50
  const skip = (page - 1) * limit;

  const total = await Task.countDocuments({ user: req.user.id });
  const tasks = await Task.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    data: tasks,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  });
});

import { User } from '../models/User.js';
import { sendWhatsAppMessage, userSockets } from '../services/whatsappService.js';

export const createTask = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, description, priority, dueDate, category, status } = req.body;
  const task = await Task.create({
    title, description, priority, dueDate, category, status, user: req.user.id
  });
  
  // Fire and forget WhatsApp notification to prevent blocking API response
  (async () => {
    try {
      const user = await User.findById(req.user.id);
      if (user && user.whatsappNumber && userSockets.has(req.user.id)) {
        const message = `🔔 *New Task Added*\n\n*Title:* ${title}\n*Priority:* ${priority}\n*Status:* ${status || 'Pending'}\n${description ? `*Details:* ${description}` : ''}`;
        await sendWhatsAppMessage(req.user.id, user.whatsappNumber, message);
      }
    } catch (err) {
      console.error('Failed to send task creation WhatsApp notification:', err);
    }
  })();

  res.status(201).json(task);
});

export const updateTask = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    req.body,
    { new: true, runValidators: true }
  );
  if (!task) {
    return next(new AppError('Task not found', 404));
  }
  res.json(task);
});

export const deleteTask = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!task) {
    return next(new AppError('Task not found', 404));
  }
  res.json({ message: 'Task removed' });
});
