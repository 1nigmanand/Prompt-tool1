import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error occurred:', err.stack);

  // Default error
  let status = 500;
  let message = 'Internal Server Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = err.message;
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
  } else if (err.message.includes('API key')) {
    status = 401;
    message = 'Invalid or missing API key';
  } else if (err.message.includes('rate limit')) {
    status = 429;
    message = 'Rate limit exceeded';
  } else if (err.message.includes('timeout')) {
    status = 504;
    message = 'Request timeout';
  }

  res.status(status).json({
    error: true,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
