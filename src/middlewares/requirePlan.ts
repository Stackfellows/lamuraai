import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { User } from '../models/User.js';
import { catchAsync } from '../utils/catchAsync.js';

export const requirePlan = (allowedPlans: string[]) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const decodedUser = (req as any).user;
    if (!decodedUser) {
      return next(new AppError('Not logged in', 401));
    }

    const user = await User.findById(decodedUser.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const { plan, trialStartDate } = user;

    if (plan === 'trial') {
      const trialDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      const trialStart = new Date(trialStartDate).getTime();
      const now = Date.now();

      if (now - trialStart > trialDuration) {
        return next(new AppError('Trial period has expired. Please upgrade your plan.', 403));
      }
      
      // Active trials get full access.
      return next();
    }

    if (plan === 'premium') {
      return next(); // Premium has access to everything
    }

    if (!allowedPlans.includes(plan)) {
      return next(new AppError(`Your current plan does not allow access to this feature. Required plan: ${allowedPlans.join(' or ')}`, 403));
    }

    next();
  });
};
