import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  console.log(`[${timestamp}] ${method} ${url} - ${userAgent}`);
  
  // Log request body for debugging (exclude sensitive data)
  if (req.body && Object.keys(req.body).length > 0) {
    const logBody = { ...req.body };
    // Remove sensitive fields
    if (logBody.apiKey) logBody.apiKey = '[REDACTED]';
    if (logBody.password) logBody.password = '[REDACTED]';
    console.log(`[${timestamp}] Request body:`, logBody);
  }
  
  next();
};
