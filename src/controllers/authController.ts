import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export const register = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { name, password } = req.body;
  const email = req.body.email?.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    return next(new AppError('Email already exists', 400));
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashedPassword });
  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: user._id, name, email } });
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { password } = req.body;
  const email = req.body.email?.toLowerCase();
  const user = await User.findOne({ email });
  if (!user) {
    return next(new AppError('Invalid credentials', 400));
  }
  
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return next(new AppError('Invalid credentials', 400));
  }

  const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user._id, name: user.name, email } });
});

export const getMe = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user.id;
  const user = await User.findById(userId).select('-password');
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  res.json({ user });
});

export const updateAiSettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user.id;
  const { aiUsageType, aiTrainingData } = req.body;
  
  const user = await User.findByIdAndUpdate(
    userId, 
    { aiUsageType, aiTrainingData }, 
    { new: true, runValidators: true }
  ).select('-password');
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  res.json({ success: true, user });
});

export const upgradePlan = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user.id;
  const { plan } = req.body;
  
  if (!['basic', 'premium'].includes(plan)) {
    return next(new AppError('Invalid plan selected', 400));
  }
  
  const user = await User.findByIdAndUpdate(
    userId, 
    { plan }, 
    { new: true, runValidators: true }
  ).select('-password');
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  res.json({ success: true, user });
});

export const cancelPlan = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user.id;
  
  const user = await User.findByIdAndUpdate(
    userId, 
    { plan: 'trial', trialStartDate: new Date() }, 
    { new: true, runValidators: true }
  ).select('-password');
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  res.json({ success: true, user });
});
