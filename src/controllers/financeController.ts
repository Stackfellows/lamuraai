import { Response, NextFunction } from 'express';
import { Finance } from '../models/Finance.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { catchAsync } from '../utils/catchAsync.js';
import { AppError } from '../utils/AppError.js';

export const getTransactions = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const transactions = await Finance.find({ user: req.user.id }).sort({ date: -1 });
  res.json(transactions);
});

export const createTransaction = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { type, amount, category, description, date } = req.body;
  const transaction = await Finance.create({
    type, amount, category, description, date, user: req.user.id
  });
  res.status(201).json(transaction);
});

export const deleteTransaction = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const transaction = await Finance.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!transaction) {
    return next(new AppError('Record not found', 404));
  }
  res.json({ message: 'Record removed' });
});

export const getSettings = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  // get user from request
  const user = await import('../models/User.js').then(m => m.User.findById(req.user.id));
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  res.json({
    financeCurrency: user.financeCurrency || 'PKR',
    financeBudget: user.financeBudget || 5000
  });
});

export const updateSettings = catchAsync(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { financeCurrency, financeBudget } = req.body;
  const user = await import('../models/User.js').then(m => m.User.findByIdAndUpdate(
    req.user.id,
    { financeCurrency, financeBudget },
    { new: true, runValidators: true }
  ));
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  res.json({
    financeCurrency: user.financeCurrency,
    financeBudget: user.financeBudget
  });
});
