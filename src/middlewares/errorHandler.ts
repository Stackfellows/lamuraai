import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/ApiResponse.js';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('🔥 Global Error Handler:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json(ApiResponse.error(message, {
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  }));
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404).json(ApiResponse.error(`Route ${req.originalUrl} not found`));
};
