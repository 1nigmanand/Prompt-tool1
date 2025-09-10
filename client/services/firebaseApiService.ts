import { User } from '../types';
import { getCurrentUser, getIdToken } from './firebaseAuthService';

const BASE_URL = 'http://localhost:3002/api';

/**
 * 🔥 Firebase Backend API Service
 * Handles authenticated requests to Firebase backend
 */
class FirebaseApiService {
  
  /**
   * Get Authorization header with Firebase ID token
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await getIdToken();
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }
  
  /**
   * Create or update user profile in backend
   * @param userData User profile data
   */
  async createOrUpdateProfile(userData: {
    displayName?: string;
    photoURL?: string;
    email?: string;
  }): Promise<User> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${BASE_URL}/users/profile`, {
        method: 'POST',
        headers,
        body: JSON.stringify(userData)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create/update profile');
      }
      
      return result.data;
    } catch (error) {
      console.error('❌ Error creating/updating profile:', error);
      throw error;
    }
  }
  
  /**
   * Get user profile from backend
   */
  async getUserProfile(): Promise<User> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${BASE_URL}/users/profile`, {
        method: 'GET',
        headers
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get profile');
      }
      
      return result.data;
    } catch (error) {
      console.error('❌ Error getting profile:', error);
      throw error;
    }
  }
  
  /**
   * Save user challenge progress to backend
   * @param progress Challenge progress data
   */
  async saveProgress(progress: Record<number, any>): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${BASE_URL}/users/progress`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ progress })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save progress');
      }
      
      console.log('✅ Progress saved to backend');
    } catch (error) {
      console.error('❌ Error saving progress:', error);
      // Don't throw error to prevent breaking the app
      // Progress will still be saved locally
    }
  }
  
  /**
   * Get user challenge progress from backend
   */
  async getProgress(): Promise<Record<number, any> | null> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${BASE_URL}/users/progress`, {
        method: 'GET',
        headers
      });
      
      const result = await response.json();
      
      if (!result.success) {
        console.warn('⚠️ Failed to get progress from backend:', result.error);
        return null;
      }
      
      return result.data;
    } catch (error) {
      console.error('❌ Error getting progress:', error);
      return null;
    }
  }
  
  /**
   * Update user statistics after challenge completion
   * @param challengeScore Score from completed challenge
   * @param newStreak Updated streak count
   */
  async updateStats(challengeScore: number, newStreak: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${BASE_URL}/users/stats/update`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ challengeScore, newStreak })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update stats');
      }
      
      console.log('📈 Stats updated in backend');
    } catch (error) {
      console.error('❌ Error updating stats:', error);
      // Don't throw error to prevent breaking the app
    }
  }
  
  /**
   * Get user statistics from backend
   */
  async getUserStats(): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${BASE_URL}/users/stats`, {
        method: 'GET',
        headers
      });
      
      const result = await response.json();
      
      if (!result.success) {
        console.warn('⚠️ Failed to get stats from backend:', result.error);
        return null;
      }
      
      return result.data;
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      return null;
    }
  }
  
  /**
   * Get leaderboard data
   * @param limit Number of top users to fetch
   */
  async getLeaderboard(limit: number = 10): Promise<any[]> {
    try {
      const response = await fetch(`${BASE_URL}/users/leaderboard?limit=${limit}`);
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get leaderboard');
      }
      
      return result.data || [];
    } catch (error) {
      console.error('❌ Error getting leaderboard:', error);
      return [];
    }
  }
}

export const firebaseApiService = new FirebaseApiService();
