/**
 * 🧑‍💻 User Data Service for Workers - Firestore REST API Operations
 * Handles all user-related database operations using Firestore REST API
 * Based on server implementation but adapted for Cloudflare Workers
 */

import { FIRESTORE_BASE_URL, FIREBASE_PROJECT_ID } from '../config/firebase';
import { 
  UserDocument, 
  ChallengeProgress, 
  UserStats,
  UserProfileUpdate,
  ApiError 
} from '../types';

const USERS_COLLECTION = 'users';
const USER_STATS_COLLECTION = 'userStats';
const USER_PROGRESS_COLLECTION = 'userProgress';

export class UserDataService {
  
  /**
   * Create or update user profile in Firestore via REST API
   */
  static async createOrUpdateUser(uid: string, userData: Partial<UserDocument>, accessToken: string): Promise<UserDocument> {
    try {
      console.log(`👤 Creating/updating user: ${uid}`);
      
      // For development mode, simulate user creation/update
      if (accessToken === 'dev-mode-token') {
        console.log('🛠️ Development mode: Simulating user creation/update');
        
        const now = new Date();
        const user: UserDocument = {
          id: uid,
          email: userData.email || '',
          displayName: userData.displayName || '',
          photoURL: userData.photoURL || '',
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now
        };
        
        console.log(`✅ User simulated successfully: ${user.email}`);
        return user;
      }
      
      const userDocUrl = `${FIRESTORE_BASE_URL}/${USERS_COLLECTION}/${uid}`;
      const response = await fetch(userDocUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const now = new Date();
      
      if (response.ok) {
        // Update existing user
        const updateData = {
          fields: {
            ...userData,
            lastLoginAt: { timestampValue: now.toISOString() },
            updatedAt: { timestampValue: now.toISOString() }
          }
        };
        
        const updateResponse = await fetch(userDocUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });
        
        if (!updateResponse.ok) {
          throw new ApiError('Failed to update user', updateResponse.status);
        }
        
        const updatedDoc = await updateResponse.json();
        return this.parseFirestoreDocument(uid, updatedDoc);
      } else if (response.status === 404) {
        // Create new user
        const newUser: any = {
          fields: {
            email: { stringValue: userData.email || '' },
            displayName: { stringValue: userData.displayName || '' },
            photoURL: { stringValue: userData.photoURL || '' },
            createdAt: { timestampValue: now.toISOString() },
            updatedAt: { timestampValue: now.toISOString() },
            lastLoginAt: { timestampValue: now.toISOString() },
            totalChallengesCompleted: { integerValue: '0' },
            totalScore: { integerValue: '0' },
            currentStreak: { integerValue: '0' },
            maxStreak: { integerValue: '0' },
            isActive: { booleanValue: true }
          }
        };
        
        const createResponse = await fetch(userDocUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newUser)
        });
        
        if (!createResponse.ok) {
          throw new ApiError('Failed to create user', createResponse.status);
        }
        
        console.log(`🎉 New user created: ${uid}`);
        
        // Initialize user stats
        await this.initializeUserStats(uid, accessToken);
        
        const createdDoc = await createResponse.json();
        return this.parseFirestoreDocument(uid, createdDoc);
      } else {
        throw new ApiError('Failed to fetch user', response.status);
      }
    } catch (error) {
      console.error(`❌ Error creating/updating user ${uid}:`, error);
      throw new ApiError(`Failed to create/update user: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
  
  /**
   * Get user profile by UID
   */
  static async getUserById(uid: string, accessToken: string): Promise<UserDocument | null> {
    try {
      console.log(`🔍 Fetching user: ${uid}`);
      
      const userDocUrl = `${FIRESTORE_BASE_URL}/${USERS_COLLECTION}/${uid}`;
      const response = await fetch(userDocUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 404) {
        console.log(`❓ User not found: ${uid}`);
        return null;
      }
      
      if (!response.ok) {
        throw new ApiError('Failed to fetch user', response.status);
      }
      
      const userDoc = await response.json();
      const userData = this.parseFirestoreDocument(uid, userDoc);
      console.log(`✅ User found: ${userData.email}`);
      
      return userData;
    } catch (error) {
      console.error(`❌ Error fetching user ${uid}:`, error);
      throw new ApiError(`Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
  
  /**
   * Update user profile
   */
  static async updateUserProfile(uid: string, updates: UserProfileUpdate, accessToken: string): Promise<UserDocument> {
    try {
      console.log(`📝 Updating user profile: ${uid}`);
      
      const userDocUrl = `${FIRESTORE_BASE_URL}/${USERS_COLLECTION}/${uid}`;
      const updateData = {
        fields: {
          ...updates,
          updatedAt: { timestampValue: new Date().toISOString() }
        }
      };
      
      const response = await fetch(userDocUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        throw new ApiError('Failed to update user profile', response.status);
      }
      
      const updatedDoc = await response.json();
      const userData = this.parseFirestoreDocument(uid, updatedDoc);
      
      console.log(`✅ User profile updated: ${uid}`);
      return userData;
    } catch (error) {
      console.error(`❌ Error updating user profile ${uid}:`, error);
      throw new ApiError(`Failed to update user profile: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
  
  /**
   * Save user challenge progress
   */
  static async saveUserProgress(uid: string, progress: Record<number, ChallengeProgress>, accessToken: string): Promise<void> {
    try {
      console.log(`💾 Saving progress for user: ${uid}`);
      
      const progressDocUrl = `${FIRESTORE_BASE_URL}/${USER_PROGRESS_COLLECTION}/${uid}`;
      const progressData = {
        fields: {
          userId: { stringValue: uid },
          progress: { mapValue: { fields: this.convertProgressToFirestore(progress) } },
          lastUpdated: { timestampValue: new Date().toISOString() }
        }
      };
      
      const response = await fetch(progressDocUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(progressData)
      });
      
      if (!response.ok) {
        throw new ApiError('Failed to save user progress', response.status);
      }
      
      console.log(`✅ Progress saved for user: ${uid}`);
    } catch (error) {
      console.error(`❌ Error saving progress for user ${uid}:`, error);
      throw new ApiError(`Failed to save user progress: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
  
  /**
   * Get user challenge progress
   */
  static async getUserProgress(uid: string, accessToken: string): Promise<Record<number, ChallengeProgress> | null> {
    try {
      console.log(`📊 Fetching progress for user: ${uid}`);
      
      const progressDocUrl = `${FIRESTORE_BASE_URL}/${USER_PROGRESS_COLLECTION}/${uid}`;
      const response = await fetch(progressDocUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 404) {
        console.log(`❓ No progress found for user: ${uid}`);
        return null;
      }
      
      if (!response.ok) {
        throw new ApiError('Failed to fetch user progress', response.status);
      }
      
      const progressDoc = await response.json() as any;
      const progress = this.parseProgressFromFirestore(progressDoc.fields?.progress?.mapValue?.fields || {});
      
      console.log(`✅ Progress loaded for user: ${uid}`);
      return progress;
    } catch (error) {
      console.error(`❌ Error fetching progress for user ${uid}:`, error);
      throw new ApiError(`Failed to fetch user progress: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
  
  /**
   * Update user statistics after challenge completion
   */
  static async updateUserStats(uid: string, challengeScore: number, newStreak: number, accessToken: string): Promise<UserStats> {
    try {
      console.log(`📈 Updating stats for user: ${uid}`);
      
      // Get current stats
      const statsDocUrl = `${FIRESTORE_BASE_URL}/${USER_STATS_COLLECTION}/${uid}`;
      const statsResponse = await fetch(statsDocUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      let currentStats: UserStats | null = null;
      if (statsResponse.ok) {
        const statsDoc = await statsResponse.json();
        currentStats = this.parseStatsFromFirestore(uid, statsDoc);
      }
      
      // Calculate updated stats
      const updatedStats: UserStats = {
        userId: uid,
        totalChallengesAttempted: (currentStats?.totalChallengesAttempted || 0) + 1,
        totalChallengesCompleted: (currentStats?.totalChallengesCompleted || 0) + 1,
        averageSimilarityScore: challengeScore,
        averageScore: 0, // Will be calculated
        bestSimilarityScore: Math.max(currentStats?.bestSimilarityScore || 0, challengeScore),
        totalTimeSpent: (currentStats?.totalTimeSpent || 0) + 5, // Default 5 minutes
        streak: newStreak,
        currentStreak: newStreak,
        maxStreak: Math.max(currentStats?.maxStreak || 0, newStreak),
        level: Math.floor(((currentStats?.totalChallengesCompleted || 0) + 1) / 5) + 1,
        experiencePoints: (currentStats?.experiencePoints || 0) + challengeScore,
        totalScore: (currentStats?.totalScore || 0) + challengeScore,
        lastChallengeAt: new Date(),
        updatedAt: new Date()
      };
      
      // Calculate average score
      if (updatedStats.totalScore && updatedStats.totalChallengesCompleted > 0) {
        updatedStats.averageScore = updatedStats.totalScore / updatedStats.totalChallengesCompleted;
      }
      
      // Update stats document
      const statsData = {
        fields: {
          userId: { stringValue: uid },
          totalChallengesCompleted: { integerValue: updatedStats.totalChallengesCompleted.toString() },
          totalScore: { integerValue: updatedStats.totalScore!.toString() },
          currentStreak: { integerValue: updatedStats.currentStreak!.toString() },
          maxStreak: { integerValue: updatedStats.maxStreak!.toString() },
          averageScore: { doubleValue: updatedStats.averageScore! },
          lastChallengeAt: { timestampValue: updatedStats.lastChallengeAt!.toISOString() },
          updatedAt: { timestampValue: updatedStats.updatedAt!.toISOString() }
        }
      };
      
      const updateResponse = await fetch(statsDocUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(statsData)
      });
      
      if (!updateResponse.ok) {
        throw new ApiError('Failed to update user stats', updateResponse.status);
      }
      
      console.log(`✅ Stats updated for user: ${uid}`);
      return updatedStats;
    } catch (error) {
      console.error(`❌ Error updating stats for user ${uid}:`, error);
      throw new ApiError(`Failed to update user stats: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
  
  /**
   * Get user statistics
   */
  static async getUserStats(uid: string, accessToken: string): Promise<UserStats | null> {
    try {
      console.log(`📊 Fetching stats for user: ${uid}`);
      
      const statsDocUrl = `${FIRESTORE_BASE_URL}/${USER_STATS_COLLECTION}/${uid}`;
      const response = await fetch(statsDocUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 404) {
        console.log(`❓ No stats found for user: ${uid}`);
        return null;
      }
      
      if (!response.ok) {
        throw new ApiError('Failed to fetch user stats', response.status);
      }
      
      const statsDoc = await response.json();
      const stats = this.parseStatsFromFirestore(uid, statsDoc);
      console.log(`✅ Stats loaded for user: ${uid}`);
      
      return stats;
    } catch (error) {
      console.error(`❌ Error fetching stats for user ${uid}:`, error);
      throw new ApiError(`Failed to fetch user stats: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
  
  /**
   * Initialize user stats document
   */
  private static async initializeUserStats(uid: string, accessToken: string): Promise<void> {
    try {
      // For development mode, simulate stats initialization
      if (accessToken === 'dev-mode-token') {
        console.log(`📊 Initial stats simulated for user: ${uid}`);
        return;
      }
      
      const statsDocUrl = `${FIRESTORE_BASE_URL}/${USER_STATS_COLLECTION}/${uid}`;
      
      const initialStats = {
        fields: {
          userId: { stringValue: uid },
          totalChallengesCompleted: { integerValue: '0' },
          totalScore: { integerValue: '0' },
          currentStreak: { integerValue: '0' },
          maxStreak: { integerValue: '0' },
          averageScore: { doubleValue: 0 },
          lastChallengeAt: { timestampValue: new Date().toISOString() },
          updatedAt: { timestampValue: new Date().toISOString() }
        }
      };
      
      const response = await fetch(statsDocUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(initialStats)
      });
      
      if (!response.ok) {
        throw new ApiError('Failed to initialize user stats', response.status);
      }
      
      console.log(`📊 Initial stats created for user: ${uid}`);
    } catch (error) {
      console.error(`❌ Error initializing stats for user ${uid}:`, error);
      throw error;
    }
  }
  
  /**
   * Get leaderboard data
   */
  static async getLeaderboard(limit: number = 10, accessToken: string): Promise<UserStats[]> {
    try {
      console.log(`🏆 Fetching leaderboard (top ${limit})`);
      
      // Note: Firestore REST API doesn't support orderBy directly in the URL
      // You would need to implement this using queries or structured documents
      const statsCollectionUrl = `${FIRESTORE_BASE_URL}/${USER_STATS_COLLECTION}`;
      const response = await fetch(statsCollectionUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new ApiError('Failed to fetch leaderboard', response.status);
      }
      
      const collection = await response.json() as any;
      const documents = collection.documents || [];
      
      // Parse and sort in memory (for simplicity)
      const leaderboard = documents
        .map((doc: any) => this.parseStatsFromFirestore(doc.name.split('/').pop(), doc))
        .sort((a: UserStats, b: UserStats) => (b.totalScore || 0) - (a.totalScore || 0))
        .slice(0, limit);
      
      console.log(`✅ Leaderboard fetched: ${leaderboard.length} entries`);
      return leaderboard;
    } catch (error) {
      console.error(`❌ Error fetching leaderboard:`, error);
      throw new ApiError(`Failed to fetch leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
  
  /**
   * Delete user and all associated data
   */
  static async deleteUser(uid: string, accessToken: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting user: ${uid}`);
      
      // Delete user document
      const userDocUrl = `${FIRESTORE_BASE_URL}/${USERS_COLLECTION}/${uid}`;
      await fetch(userDocUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Delete user stats
      const statsDocUrl = `${FIRESTORE_BASE_URL}/${USER_STATS_COLLECTION}/${uid}`;
      await fetch(statsDocUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Delete user progress
      const progressDocUrl = `${FIRESTORE_BASE_URL}/${USER_PROGRESS_COLLECTION}/${uid}`;
      await fetch(progressDocUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ User deleted: ${uid}`);
    } catch (error) {
      console.error(`❌ Error deleting user ${uid}:`, error);
      throw new ApiError(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }
  
  /**
   * Helper method to parse Firestore document to UserDocument
   */
  private static parseFirestoreDocument(uid: string, doc: any): UserDocument {
    const fields = doc.fields || {};
    return {
      id: uid,
      email: fields.email?.stringValue || '',
      displayName: fields.displayName?.stringValue || '',
      photoURL: fields.photoURL?.stringValue || '',
      createdAt: new Date(fields.createdAt?.timestampValue || Date.now()),
      updatedAt: new Date(fields.updatedAt?.timestampValue || Date.now()),
      lastLoginAt: new Date(fields.lastLoginAt?.timestampValue || Date.now())
    };
  }
  
  /**
   * Helper method to parse Firestore document to UserStats
   */
  private static parseStatsFromFirestore(uid: string, doc: any): UserStats {
    const fields = doc.fields || {};
    return {
      userId: uid,
      totalChallengesAttempted: parseInt(fields.totalChallengesAttempted?.integerValue || '0'),
      totalChallengesCompleted: parseInt(fields.totalChallengesCompleted?.integerValue || '0'),
      averageSimilarityScore: fields.averageSimilarityScore?.doubleValue || 0,
      averageScore: fields.averageScore?.doubleValue || 0,
      bestSimilarityScore: fields.bestSimilarityScore?.doubleValue || 0,
      totalTimeSpent: parseInt(fields.totalTimeSpent?.integerValue || '0'),
      streak: parseInt(fields.streak?.integerValue || '0'),
      currentStreak: parseInt(fields.currentStreak?.integerValue || '0'),
      maxStreak: parseInt(fields.maxStreak?.integerValue || '0'),
      level: parseInt(fields.level?.integerValue || '1'),
      experiencePoints: parseInt(fields.experiencePoints?.integerValue || '0'),
      totalScore: parseInt(fields.totalScore?.integerValue || '0'),
      lastChallengeAt: new Date(fields.lastChallengeAt?.timestampValue || Date.now()),
      updatedAt: new Date(fields.updatedAt?.timestampValue || Date.now())
    };
  }
  
  /**
   * Helper method to convert progress to Firestore format
   */
  private static convertProgressToFirestore(progress: Record<number, ChallengeProgress>): any {
    const firestoreProgress: any = {};
    
    for (const [challengeId, challengeProgress] of Object.entries(progress)) {
      firestoreProgress[challengeId] = {
        mapValue: {
          fields: {
            challengeId: { integerValue: challengeProgress.challengeId.toString() },
            status: { stringValue: challengeProgress.status },
            streak: { integerValue: (challengeProgress.streak || 0).toString() },
            previousSimilarityScore: { integerValue: (challengeProgress.previousSimilarityScore || 0).toString() },
            completedAt: challengeProgress.completedAt ? { timestampValue: challengeProgress.completedAt.toISOString() } : null,
            attempts: { integerValue: challengeProgress.attempts.toString() },
            bestScore: challengeProgress.bestScore ? { integerValue: challengeProgress.bestScore.toString() } : null
          }
        }
      };
    }
    
    return firestoreProgress;
  }
  
  /**
   * Helper method to parse progress from Firestore format
   */
  private static parseProgressFromFirestore(firestoreProgress: any): Record<number, ChallengeProgress> {
    const progress: Record<number, ChallengeProgress> = {};
    
    for (const [challengeId, challengeData] of Object.entries(firestoreProgress)) {
      const fields = (challengeData as any).mapValue?.fields || {};
      progress[parseInt(challengeId)] = {
        challengeId: parseInt(challengeId),
        status: fields.status?.stringValue || 'locked',
        streak: parseInt(fields.streak?.integerValue || '0'),
        previousSimilarityScore: parseInt(fields.previousSimilarityScore?.integerValue || '0'),
        completedAt: fields.completedAt?.timestampValue ? new Date(fields.completedAt.timestampValue) : undefined,
        attempts: fields.attempts?.integerValue ? parseInt(fields.attempts.integerValue) : 0,
        bestScore: fields.bestScore?.integerValue ? parseInt(fields.bestScore.integerValue) : undefined
      };
    }
    
    return progress;
  }
}
