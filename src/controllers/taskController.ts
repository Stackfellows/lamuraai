import { Response, NextFunction } from 'express';
import { Task } from '../models/Task.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

export const getTasks = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json(tasks);
});

import { User } from '../models/User.js';
import { sendWhatsAppMessage, userSockets } from '../services/whatsappService.js';

export const createTask = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, description, priority, dueDate, category, status } = req.body;
  const task = await Task.create({
    title, description, priority, dueDate, category, status, user: req.user.id
  });
  
  try {
    const user = await User.findById(req.user.id);
    if (user && user.whatsappNumber && userSockets.has(req.user.id)) {
      const message = `🔔 *New Task Added*\n\n*Title:* ${title}\n*Priority:* ${priority}\n*Status:* ${status || 'Pending'}\n${description ? `*Details:* ${description}` : ''}`;
      await sendWhatsAppMessage(req.user.id, user.whatsappNumber, message);
    }
  } catch (err) {
    console.error('Failed to send task creation WhatsApp notification:', err);
  }

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
