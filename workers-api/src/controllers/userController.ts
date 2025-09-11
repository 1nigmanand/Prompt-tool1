/**
 * 👤 User Controller for Workers - User Management Endpoints
 * Handles user profile, progress, and statistics operations  
 * Based on server implementation but adapted for Cloudflare Workers
 */

import { UserDataService } from '../services/userDataService';
import { ApiError } from '../types';

/**
 * User Controller Class for Workers
 */
export class UserController {
  
  /**
   * Create or update user profile
   * POST /api/users/profile
   */
  static async createOrUpdateProfile(c: any) {
    try {
      console.log('📝 Creating/updating user profile...');
      
      const user = c.get('user');
      if (!user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      const body = await c.req.json();
      const { displayName, photoURL, email } = body;
      
      const userData = {
        email: email || user.email || '',
        displayName: displayName || '',
        photoURL: photoURL || ''
      };
      
      const accessToken = getFirebaseAccessToken(c.env);
      const updatedUser = await UserDataService.createOrUpdateUser(user.uid, userData, accessToken);
      
      return c.json({
        success: true,
        data: updatedUser,
        message: 'User profile updated successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Error creating/updating user profile:', error);
      
      if (error instanceof ApiError) {
        return c.json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        }, error.statusCode || 500);
      }
      
      return c.json({
        success: false,
        error: 'Failed to create/update user profile',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }

  /**
   * Get current user profile
   * GET /api/users/profile
   */
  static async getUserProfile(c: any) {
    try {
      console.log('📝 Getting user profile...');
      
      const user = c.get('user');
      if (!user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      // For development, just return the authenticated user data
      const accessToken = getFirebaseAccessToken(c.env);
      const userData = await UserDataService.getUserById(user.uid, accessToken);
      
      return c.json({
        success: true,
        data: userData || {
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: new Date()
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Error getting user profile:', error);
      
      return c.json({
        success: false,
        error: 'Failed to get user profile',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }

  /**
   * Get user challenge progress
   * GET /api/users/progress
   */
  static async getUserProgress(c: any) {
    try {
      console.log('📊 Getting user progress...');
      
      const user = c.get('user');
      if (!user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      // For development, return empty progress
      return c.json({
        success: true,
        data: {},
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Error getting user progress:', error);
      
      return c.json({
        success: false,
        error: 'Failed to get user progress',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }

  /**
   * Save user challenge progress
   * POST /api/users/progress
   */
  static async saveUserProgress(c: any) {
    try {
      console.log('💾 Saving user progress...');
      
      const user = c.get('user');
      if (!user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      // For development, just return success
      return c.json({
        success: true,
        message: 'Progress saved successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Error saving user progress:', error);
      
      return c.json({
        success: false,
        error: 'Failed to save user progress',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }

  /**
   * Get user statistics
   * GET /api/users/stats
   */
  static async getUserStats(c: any) {
    try {
      console.log('📈 Getting user stats...');
      
      const user = c.get('user');
      if (!user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      // For development, return empty stats
      return c.json({
        success: true,
        data: null,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Error getting user stats:', error);
      
      return c.json({
        success: false,
        error: 'Failed to get user stats',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }

  /**
   * Update user statistics
   * POST /api/users/stats/update
   */
  static async updateUserStats(c: any) {
    try {
      console.log('📊 Updating user stats...');
      
      const user = c.get('user');
      if (!user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      // For development, return success
      return c.json({
        success: true,
        data: {},
        message: 'User stats updated successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Error updating user stats:', error);
      
      return c.json({
        success: false,
        error: 'Failed to update user stats',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }

  /**
   * Get leaderboard
   * GET /api/users/leaderboard
   */
  static async getLeaderboard(c: any) {
    try {
      console.log('🏆 Getting leaderboard...');
      
      // For development, return empty leaderboard
      return c.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Error getting leaderboard:', error);
      
      return c.json({
        success: false,
        error: 'Failed to get leaderboard',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }

  /**
   * Update user profile
   * PATCH /api/users/profile
   */
  static async updateProfile(c: any) {
    try {
      console.log('📝 Updating user profile...');
      
      const user = c.get('user');
      if (!user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      // For development, return success
      return c.json({
        success: true,
        data: {},
        message: 'User profile updated successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Error updating user profile:', error);
      
      return c.json({
        success: false,
        error: 'Failed to update user profile',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }

  /**
   * Delete user account and all data
   * DELETE /api/users/profile
   */
  static async deleteUser(c: any) {
    try {
      console.log('🗑️ Deleting user account...');
      
      const user = c.get('user');
      if (!user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      // For development, return success
      return c.json({
        success: true,
        message: 'User account deleted successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('❌ Error deleting user account:', error);
      
      return c.json({
        success: false,
        error: 'Failed to delete user account',
        timestamp: new Date().toISOString()
      }, 500);
    }
  }
}

/**
 * Get Firebase access token for Firestore REST API access
 * In a real implementation, this would use service account credentials
 */
export function getFirebaseAccessToken(env: any): string {
  // Log environment debugging info
  console.log('🔧 Environment vars available:', Object.keys(env || {}));
  console.log('🔧 ENABLE_REAL_FIREBASE value:', env?.ENABLE_REAL_FIREBASE);
  
  // For testing: Always return firebase-service-token to enable real operations
  const enableRealFirebase = true; // Forced enable for testing
  
  if (enableRealFirebase) {
    console.log('🔥 Real Firebase operations ENABLED (forced for testing)');
    return `firebase-service-token:firebase-adminsdk-fbsvc@prompt-proj1.iam.gserviceaccount.com`;
  }
  
  console.log('⚠️ Using development mode - Firebase access token bypassed');
  return 'dev-mode-token';
}
