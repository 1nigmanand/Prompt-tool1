/**
 * 🛠️ Error Handler Middleware for Cloudflare Workers
 * Based on server implementation
 */

import { ApiError } from '../types';

export function errorHandler(err: Error, c: any) {
  console.error('Error occurred:', err.stack);

  // Default error
  let status = 500;
  let message = 'Internal Server Error';

  // Handle specific error types
  if (err instanceof ApiError) {
    status = err.statusCode || 500;
    message = err.message;
  } else if (err.name === 'ValidationError') {
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

  return c.json({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    // Include stack trace in development
    ...(c.env?.NODE_ENV === 'development' && { stack: err.stack })
  }, status);
}

/**
 * Request Logger Middleware for Cloudflare Workers
 */
export function requestLogger(c: any, next: () => Promise<void>) {
  const timestamp = new Date().toISOString();
  const method = c.req.method;
  const url = c.req.url;
  const userAgent = c.req.header('User-Agent') || 'Unknown';
  
  console.log(`[${timestamp}] ${method} ${url} - ${userAgent}`);
  
  return next();
}
