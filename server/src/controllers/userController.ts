import { Request, Response } from 'express';
import { UserDataService } from '../services/userDataService.js';
import { ApiError, UserDocument } from '../types/index.js';

/**
 * 👤 User Controller - User Management Endpoints
 * Handles user profile, progress, and statistics operations
 */
export class UserController {
  
  /**
   * Get current user profile
   * GET /api/users/profile
   */
  static async getUserProfile(req: Request, res: Response): Promise<void> {
    try {
      console.log('📝 Getting user profile...');
      
      if (!req.user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      const user = await UserDataService.getUserById(req.user.uid);
      
      if (!user) {
        throw new ApiError('User not found', 404, 'USER_NOT_FOUND');
      }
      
      res.json({
        success: true,
        data: user,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      
      if (error instanceof ApiError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to get user profile',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Create or update user profile
   * POST /api/users/profile
   */
  static async createOrUpdateProfile(req: Request, res: Response): Promise<void> {
    try {
      console.log('📝 Creating/updating user profile...');
      
      if (!req.user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      const { displayName, photoURL, email } = req.body;
      
      const userData: Partial<UserDocument> = {
        email: email || req.user.email || '',
        displayName: displayName || '',
        photoURL: photoURL || ''
      };
      
      const user = await UserDataService.createOrUpdateUser(req.user.uid, userData);
      
      res.json({
        success: true,
        data: user,
        message: 'User profile updated successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error creating/updating user profile:', error);
      
      if (error instanceof ApiError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create/update user profile',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Update user profile
   * PATCH /api/users/profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      console.log('📝 Updating user profile...');
      
      if (!req.user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      const updates = req.body;
      
      // Validate updates
      const allowedFields = ['displayName', 'photoURL', 'email'];
      const invalidFields = Object.keys(updates).filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        throw new ApiError(`Invalid fields: ${invalidFields.join(', ')}`, 400, 'INVALID_FIELDS');
      }
      
      const user = await UserDataService.updateUserProfile(req.user.uid, updates);
      
      res.json({
        success: true,
        data: user,
        message: 'User profile updated successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      
      if (error instanceof ApiError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update user profile',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Get user challenge progress
   * GET /api/users/progress
   */
  static async getUserProgress(req: Request, res: Response): Promise<void> {
    try {
      console.log('📊 Getting user progress...');
      
      if (!req.user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      const progress = await UserDataService.getUserProgress(req.user.uid);
      
      res.json({
        success: true,
        data: progress || {},
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error getting user progress:', error);
      
      if (error instanceof ApiError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to get user progress',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Save user challenge progress
   * POST /api/users/progress
   */
  static async saveUserProgress(req: Request, res: Response): Promise<void> {
    try {
      console.log('💾 Saving user progress...');
      
      if (!req.user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      const { progress } = req.body;
      
      if (!progress || typeof progress !== 'object') {
        throw new ApiError('Invalid progress data', 400, 'INVALID_PROGRESS_DATA');
      }
      
      await UserDataService.saveUserProgress(req.user.uid, progress);
      
      res.json({
        success: true,
        message: 'Progress saved successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error saving user progress:', error);
      
      if (error instanceof ApiError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to save user progress',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Get user statistics
   * GET /api/users/stats
   */
  static async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      console.log('📈 Getting user stats...');
      
      if (!req.user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      const stats = await UserDataService.getUserStats(req.user.uid);
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error getting user stats:', error);
      
      if (error instanceof ApiError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to get user stats',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Update user stats after challenge completion
   * POST /api/users/stats/update
   */
  static async updateUserStats(req: Request, res: Response): Promise<void> {
    try {
      console.log('📈 Updating user stats...');
      
      if (!req.user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      const { challengeScore, newStreak } = req.body;
      
      if (typeof challengeScore !== 'number' || typeof newStreak !== 'number') {
        throw new ApiError('Invalid score or streak data', 400, 'INVALID_STATS_DATA');
      }
      
      const stats = await UserDataService.updateUserStats(req.user.uid, challengeScore, newStreak);
      
      res.json({
        success: true,
        data: stats,
        message: 'Stats updated successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error updating user stats:', error);
      
      if (error instanceof ApiError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update user stats',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Get leaderboard
   * GET /api/users/leaderboard
   */
  static async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      console.log('🏆 Getting leaderboard...');
      
      const limit = parseInt(req.query.limit as string) || 10;
      
      if (limit < 1 || limit > 100) {
        throw new ApiError('Limit must be between 1 and 100', 400, 'INVALID_LIMIT');
      }
      
      const leaderboard = await UserDataService.getLeaderboard(limit);
      
      res.json({
        success: true,
        data: leaderboard,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error getting leaderboard:', error);
      
      if (error instanceof ApiError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to get leaderboard',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Delete user account
   * DELETE /api/users/profile
   */
  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      console.log('🗑️ Deleting user account...');
      
      if (!req.user?.uid) {
        throw new ApiError('User not authenticated', 401, 'NOT_AUTHENTICATED');
      }
      
      await UserDataService.deleteUser(req.user.uid);
      
      res.json({
        success: true,
        message: 'User account deleted successfully',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      
      if (error instanceof ApiError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete user account',
        timestamp: new Date().toISOString()
      });
    }
  }
}
