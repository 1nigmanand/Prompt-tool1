import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { authenticateFirebaseToken, optionalAuth } from '../middleware/firebaseAuth.js';

const router = Router();

/**
 * 👤 User Routes - Firebase Auth Protected Endpoints
 * All routes require Firebase authentication except leaderboard
 */

// User Profile Routes
router.get('/profile', authenticateFirebaseToken, UserController.getUserProfile);
router.post('/profile', authenticateFirebaseToken, UserController.createOrUpdateProfile);
router.patch('/profile', authenticateFirebaseToken, UserController.updateProfile);
router.delete('/profile', authenticateFirebaseToken, UserController.deleteUser);

// User Progress Routes
router.get('/progress', authenticateFirebaseToken, UserController.getUserProgress);
router.post('/progress', authenticateFirebaseToken, UserController.saveUserProgress);

// User Statistics Routes
router.get('/stats', authenticateFirebaseToken, UserController.getUserStats);
router.post('/stats/update', authenticateFirebaseToken, UserController.updateUserStats);

// Leaderboard (optionally authenticated for user context)
router.get('/leaderboard', optionalAuth, UserController.getLeaderboard);

export default router;
