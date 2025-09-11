/**
 * User Routes for Workers API
 * Firebase Auth Protected Endpoints
 */

import { Hono } from 'hono';
import { UserController } from '../controllers/userController';
import { authenticateFirebaseToken, optionalAuth } from '../middleware/firebaseAuth';

const userRoutes = new Hono();

/**
 * 👤 User Routes - Firebase Auth Protected Endpoints
 * All routes require Firebase authentication except leaderboard
 */

// User Profile Routes
userRoutes.get('/profile', authenticateFirebaseToken, UserController.getUserProfile);
userRoutes.post('/profile', authenticateFirebaseToken, UserController.createOrUpdateProfile);
userRoutes.patch('/profile', authenticateFirebaseToken, UserController.updateProfile);
userRoutes.delete('/profile', authenticateFirebaseToken, UserController.deleteUser);

// User Progress Routes
userRoutes.get('/progress', authenticateFirebaseToken, UserController.getUserProgress);
userRoutes.post('/progress', authenticateFirebaseToken, UserController.saveUserProgress);

// User Statistics Routes
userRoutes.get('/stats', authenticateFirebaseToken, UserController.getUserStats);
userRoutes.post('/stats/update', authenticateFirebaseToken, UserController.updateUserStats);

// Leaderboard (optionally authenticated for user context)
userRoutes.get('/leaderboard', optionalAuth, UserController.getLeaderboard);

export default userRoutes;
