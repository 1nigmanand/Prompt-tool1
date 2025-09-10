import { db } from '../config/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  UserDocument, 
  ChallengeProgress, 
  UserStats,
  UserProfileUpdate 
} from '../types/index.js';

const USERS_COLLECTION = 'users';
const USER_STATS_COLLECTION = 'userStats';
const USER_PROGRESS_COLLECTION = 'userProgress';

/**
 * 🧑‍💻 User Data Service - Firestore Operations
 * Handles all user-related database operations with comprehensive error handling
 */
export class UserDataService {
  
  /**
   * Create or update user profile in Firestore
   * @param uid Firebase Auth UID
   * @param userData User profile data
   * @returns Promise<UserDocument>
   */
  static async createOrUpdateUser(uid: string, userData: Partial<UserDocument>): Promise<UserDocument> {
    try {
      console.log(`👤 Creating/updating user: ${uid}`);
      
      const userRef = db.collection(USERS_COLLECTION).doc(uid);
      const userDoc = await userRef.get();
      
      const now = new Date();
      
      if (userDoc.exists) {
        // Update existing user
        const updateData = {
          ...userData,
          lastLoginAt: now,
          updatedAt: now
        };
        
        await userRef.update(updateData);
        console.log(`✅ User updated: ${uid}`);
        
        const updatedDoc = await userRef.get();
        return { id: uid, ...updatedDoc.data() } as UserDocument;
      } else {
        // Create new user
        const newUser: UserDocument = {
          id: uid,
          email: userData.email || '',
          displayName: userData.displayName || '',
          photoURL: userData.photoURL || '',
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
          totalChallengesCompleted: 0,
          totalScore: 0,
          currentStreak: 0,
          maxStreak: 0,
          isActive: true,
          ...userData
        };
        
        await userRef.set(newUser);
        console.log(`🎉 New user created: ${uid}`);
        
        // Initialize user stats
        await this.initializeUserStats(uid);
        
        return newUser;
      }
    } catch (error) {
      console.error(`❌ Error creating/updating user ${uid}:`, error);
      throw new Error(`Failed to create/update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get user profile by UID
   * @param uid Firebase Auth UID
   * @returns Promise<UserDocument | null>
   */
  static async getUserById(uid: string): Promise<UserDocument | null> {
    try {
      console.log(`🔍 Fetching user: ${uid}`);
      
      const userDoc = await db.collection(USERS_COLLECTION).doc(uid).get();
      
      if (!userDoc.exists) {
        console.log(`❓ User not found: ${uid}`);
        return null;
      }
      
      const userData = { id: uid, ...userDoc.data() } as UserDocument;
      console.log(`✅ User found: ${userData.email}`);
      
      return userData;
    } catch (error) {
      console.error(`❌ Error fetching user ${uid}:`, error);
      throw new Error(`Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update user profile
   * @param uid Firebase Auth UID
   * @param updates Profile updates
   * @returns Promise<UserDocument>
   */
  static async updateUserProfile(uid: string, updates: UserProfileUpdate): Promise<UserDocument> {
    try {
      console.log(`📝 Updating user profile: ${uid}`);
      
      const userRef = db.collection(USERS_COLLECTION).doc(uid);
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await userRef.update(updateData);
      
      const updatedDoc = await userRef.get();
      const userData = { id: uid, ...updatedDoc.data() } as UserDocument;
      
      console.log(`✅ User profile updated: ${uid}`);
      return userData;
    } catch (error) {
      console.error(`❌ Error updating user profile ${uid}:`, error);
      throw new Error(`Failed to update user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Save user challenge progress
   * @param uid Firebase Auth UID
   * @param progress Challenge progress data
   * @returns Promise<void>
   */
  static async saveUserProgress(uid: string, progress: Record<number, ChallengeProgress>): Promise<void> {
    try {
      console.log(`💾 Saving progress for user: ${uid}`);
      
      const progressRef = db.collection(USER_PROGRESS_COLLECTION).doc(uid);
      
      await progressRef.set({
        userId: uid,
        progress,
        lastUpdated: new Date()
      });
      
      console.log(`✅ Progress saved for user: ${uid}`);
    } catch (error) {
      console.error(`❌ Error saving progress for user ${uid}:`, error);
      throw new Error(`Failed to save user progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get user challenge progress
   * @param uid Firebase Auth UID
   * @returns Promise<Record<number, ChallengeProgress> | null>
   */
  static async getUserProgress(uid: string): Promise<Record<number, ChallengeProgress> | null> {
    try {
      console.log(`📊 Fetching progress for user: ${uid}`);
      
      const progressDoc = await db.collection(USER_PROGRESS_COLLECTION).doc(uid).get();
      
      if (!progressDoc.exists) {
        console.log(`❓ No progress found for user: ${uid}`);
        return null;
      }
      
      const data = progressDoc.data();
      console.log(`✅ Progress loaded for user: ${uid}`);
      
      return data?.progress || null;
    } catch (error) {
      console.error(`❌ Error fetching progress for user ${uid}:`, error);
      throw new Error(`Failed to fetch user progress: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update user statistics after challenge completion
   * @param uid Firebase Auth UID
   * @param challengeScore Score from completed challenge
   * @param newStreak Updated streak count
   * @returns Promise<UserStats>
   */
  static async updateUserStats(uid: string, challengeScore: number, newStreak: number): Promise<UserStats> {
    try {
      console.log(`📈 Updating stats for user: ${uid}`);
      
      const userRef = db.collection(USERS_COLLECTION).doc(uid);
      const statsRef = db.collection(USER_STATS_COLLECTION).doc(uid);
      
      // Update user document
      await userRef.update({
        totalChallengesCompleted: FieldValue.increment(1),
        totalScore: FieldValue.increment(challengeScore),
        currentStreak: newStreak,
        maxStreak: newStreak > 0 ? FieldValue.increment(0) : newStreak, // Will be handled in transaction
        lastChallengeAt: new Date(),
        updatedAt: new Date()
      });
      
      // Update detailed stats
      const statsDoc = await statsRef.get();
      const currentStats = statsDoc.exists ? statsDoc.data() as UserStats : null;
      
      const updatedStats: UserStats = {
        userId: uid,
        totalChallengesCompleted: (currentStats?.totalChallengesCompleted || 0) + 1,
        totalScore: (currentStats?.totalScore || 0) + challengeScore,
        currentStreak: newStreak,
        maxStreak: Math.max(currentStats?.maxStreak || 0, newStreak),
        averageScore: 0, // Will be calculated
        lastChallengeAt: new Date(),
        updatedAt: new Date()
      };
      
      // Calculate average score
      updatedStats.averageScore = updatedStats.totalScore / updatedStats.totalChallengesCompleted;
      
      await statsRef.set(updatedStats);
      
      console.log(`✅ Stats updated for user: ${uid}`);
      return updatedStats;
    } catch (error) {
      console.error(`❌ Error updating stats for user ${uid}:`, error);
      throw new Error(`Failed to update user stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get user statistics
   * @param uid Firebase Auth UID
   * @returns Promise<UserStats | null>
   */
  static async getUserStats(uid: string): Promise<UserStats | null> {
    try {
      console.log(`📊 Fetching stats for user: ${uid}`);
      
      const statsDoc = await db.collection(USER_STATS_COLLECTION).doc(uid).get();
      
      if (!statsDoc.exists) {
        console.log(`❓ No stats found for user: ${uid}`);
        return null;
      }
      
      const stats = statsDoc.data() as UserStats;
      console.log(`✅ Stats loaded for user: ${uid}`);
      
      return stats;
    } catch (error) {
      console.error(`❌ Error fetching stats for user ${uid}:`, error);
      throw new Error(`Failed to fetch user stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Initialize user stats document
   * @param uid Firebase Auth UID
   * @returns Promise<void>
   */
  private static async initializeUserStats(uid: string): Promise<void> {
    try {
      const statsRef = db.collection(USER_STATS_COLLECTION).doc(uid);
      
      const initialStats: UserStats = {
        userId: uid,
        totalChallengesCompleted: 0,
        totalScore: 0,
        currentStreak: 0,
        maxStreak: 0,
        averageScore: 0,
        lastChallengeAt: new Date(),
        updatedAt: new Date()
      };
      
      await statsRef.set(initialStats);
      console.log(`📊 Initial stats created for user: ${uid}`);
    } catch (error) {
      console.error(`❌ Error initializing stats for user ${uid}:`, error);
      throw error;
    }
  }
  
  /**
   * Get leaderboard data
   * @param limit Number of top users to return
   * @returns Promise<UserStats[]>
   */
  static async getLeaderboard(limit: number = 10): Promise<UserStats[]> {
    try {
      console.log(`🏆 Fetching leaderboard (top ${limit})`);
      
      const snapshot = await db.collection(USER_STATS_COLLECTION)
        .orderBy('totalScore', 'desc')
        .limit(limit)
        .get();
      
      const leaderboard = snapshot.docs.map(doc => doc.data() as UserStats);
      
      console.log(`✅ Leaderboard fetched: ${leaderboard.length} entries`);
      return leaderboard;
    } catch (error) {
      console.error(`❌ Error fetching leaderboard:`, error);
      throw new Error(`Failed to fetch leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Delete user and all associated data
   * @param uid Firebase Auth UID
   * @returns Promise<void>
   */
  static async deleteUser(uid: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting user: ${uid}`);
      
      // Delete user document
      await db.collection(USERS_COLLECTION).doc(uid).delete();
      
      // Delete user stats
      await db.collection(USER_STATS_COLLECTION).doc(uid).delete();
      
      // Delete user progress
      await db.collection(USER_PROGRESS_COLLECTION).doc(uid).delete();
      
      console.log(`✅ User deleted: ${uid}`);
    } catch (error) {
      console.error(`❌ Error deleting user ${uid}:`, error);
      throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
