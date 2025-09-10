import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase.js';
import { ApiError } from '../types/index.js';

// Extend Express Request to include Firebase user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        emailVerified?: boolean;
      };
    }
  }
}

/**
 * 🛡️ Firebase Authentication Middleware
 * Verifies Firebase JWT tokens and protects API endpoints
 */
export const authenticateFirebaseToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new ApiError('No authorization header provided', 401, 'NO_TOKEN');
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      throw new ApiError('Invalid authorization header format', 401, 'INVALID_TOKEN_FORMAT');
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new ApiError('No token provided', 401, 'NO_TOKEN');
    }
    
    console.log('🔍 Verifying Firebase token...');
    
    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);
    
    if (!decodedToken) {
      throw new ApiError('Invalid token', 401, 'INVALID_TOKEN');
    }
    
    // Add user info to request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified
    };
    
    console.log(`✅ Token verified for user: ${decodedToken.email} (${decodedToken.uid})`);
    next();
    
  } catch (error) {
    console.error('❌ Authentication failed:', error);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode || 401).json({
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Handle Firebase auth errors
    const firebaseError = error as any;
    
    if (firebaseError.code === 'auth/id-token-expired') {
      res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    if (firebaseError.code === 'auth/id-token-revoked') {
      res.status(401).json({
        success: false,
        error: 'Token revoked',
        code: 'TOKEN_REVOKED',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    if (firebaseError.code === 'auth/argument-error') {
      res.status(401).json({
        success: false,
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Generic auth error
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 🔓 Optional Authentication Middleware
 * Extracts user info if token is provided, but doesn't require authentication
 */
export const optionalAuth = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user info
      next();
      return;
    }
    
    const token = authHeader.substring(7);
    
    if (!token) {
      next();
      return;
    }
    
    try {
      const decodedToken = await auth.verifyIdToken(token);
      
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified
      };
      
      console.log(`🔓 Optional auth successful for: ${decodedToken.email}`);
    } catch (tokenError) {
      console.log('🔓 Optional auth failed, continuing without user info');
      // Continue without user info if token is invalid
    }
    
    next();
    
  } catch (error) {
    console.error('❌ Optional auth middleware error:', error);
    // Continue without user info on any error
    next();
  }
};
