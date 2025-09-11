/**
 * 🔑 Gemini API Key Manager Service
 * Handles round-robin key rotation, rate limiting, and automatic retry logic
 * Supports thousands of concurrent users with optimized key distribution
 */

import { ApiError } from './types';

interface KeyMetrics {
  key: string;
  usageCount: number;
  lastUsed: Date;
  isBlocked: boolean;
  blockUntil?: Date;
  errorCount: number;
}

export class GeminiKeyManager {
  private keys: string[] = [];
  private keyMetrics: Map<string, KeyMetrics> = new Map();
  private currentIndex: number = 0;
  private readonly maxRetries: number = 3;
  private readonly blockDurationMs: number = 60000; // 1 minute block for rate-limited keys
  private readonly maxErrorsBeforeBlock: number = 5;

  constructor(env?: any) {
    this.initializeKeys(env);
    this.startCleanupTask();
  }

  /**
   * 🚀 Initialize API keys from environment variables
   */
  private initializeKeys(env?: any): void {
    const keysFromEnv = env?.GEMINI_API_KEYS;
    
    if (!keysFromEnv) {
      // Fallback to legacy individual keys
      const legacyKeys = [];
      for (let i = 0; i <= 12; i++) {
        const key = env?.[`GEMINI_API_KEY${i === 0 ? '' : i}`];
        if (key) legacyKeys.push(key);
      }
      this.keys = legacyKeys;
    } else {
      this.keys = keysFromEnv.split(',').map((key: string) => key.trim()).filter((key: string) => key.length > 0);
    }

    if (this.keys.length === 0) {
      throw new Error('🚨 No Gemini API keys found in environment variables');
    }

    // Initialize metrics for each key
    this.keys.forEach(key => {
      this.keyMetrics.set(key, {
        key,
        usageCount: 0,
        lastUsed: new Date(0),
        isBlocked: false,
        errorCount: 0
      });
    });

    console.log(`🔑 GeminiKeyManager initialized with ${this.keys.length} API keys`);
  }

  /**
   * 🔄 Get next available API key using round-robin rotation
   */
  public getNextKey(): string {
    const availableKeys = this.getAvailableKeys();
    
    if (availableKeys.length === 0) {
      throw new ApiError(
        'All Gemini API keys are currently rate-limited or blocked. Please try again later.',
        429,
        'ALL_KEYS_EXHAUSTED'
      );
    }

    // Use round-robin on available keys
    const selectedKey = availableKeys[this.currentIndex % availableKeys.length];
    this.currentIndex = (this.currentIndex + 1) % availableKeys.length;

    // Update metrics
    const metrics = this.keyMetrics.get(selectedKey)!;
    metrics.usageCount++;
    metrics.lastUsed = new Date();

    console.log(`🔑 Selected API key: ${this.maskKey(selectedKey)} (Usage: ${metrics.usageCount})`);
    
    return selectedKey;
  }

  /**
   * 🔄 Execute API call with automatic retry and key rotation
   */
  public async executeWithRetry<T>(
    apiCall: (apiKey: string) => Promise<T>,
    operation: string = 'API call'
  ): Promise<T> {
    let lastError: Error | null = null;
    let attemptsCount = 0;
    const maxAttempts = Math.min(this.maxRetries, this.getAvailableKeys().length);

    console.log(`🚀 Starting ${operation} with key rotation (max ${maxAttempts} attempts)`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const apiKey = this.getNextKey();
        console.log(`🔄 Attempt ${attempt}/${maxAttempts} using key: ${this.maskKey(apiKey)}`);
        
        const startTime = Date.now();
        const result = await apiCall(apiKey);
        const duration = Date.now() - startTime;
        
        // Mark key as successful
        this.markKeySuccess(apiKey);
        
        console.log(`✅ ${operation} successful in ${duration}ms with key: ${this.maskKey(apiKey)}`);
        return result;

      } catch (error) {
        attemptsCount++;
        lastError = error as Error;
        
        console.log(`❌ Attempt ${attempt} failed: ${lastError.message}`);

        // Check if it's a rate limit error (429)
        if (this.isRateLimitError(lastError)) {
          const failedKey = this.getLastUsedKey();
          if (failedKey) {
            this.markKeyAsRateLimited(failedKey);
            console.log(`⏸️ Key ${this.maskKey(failedKey)} temporarily blocked due to rate limiting`);
          }
        } else {
          // For other errors, mark key as having an error
          const failedKey = this.getLastUsedKey();
          if (failedKey) {
            this.markKeyError(failedKey);
          }
        }

        // If this was the last attempt, break
        if (attempt === maxAttempts) {
          break;
        }

        // Wait a bit before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await this.sleep(waitTime);
      }
    }

    // All attempts failed
    console.log(`🚨 All ${attemptsCount} attempts failed for ${operation}`);
    
    if (this.getAvailableKeys().length === 0) {
      throw new ApiError(
        'All Gemini API keys exhausted',
        429,
        'ALL_KEYS_EXHAUSTED'
      );
    }

    throw new ApiError(
      `${operation} failed after ${attemptsCount} attempts: ${lastError?.message || 'Unknown error'}`,
      500,
      'API_CALL_FAILED'
    );
  }

  /**
   * 🔍 Get all currently available (non-blocked) keys
   */
  private getAvailableKeys(): string[] {
    const now = new Date();
    return this.keys.filter(key => {
      const metrics = this.keyMetrics.get(key)!;
      
      // Check if key is temporarily blocked
      if (metrics.isBlocked && metrics.blockUntil && now < metrics.blockUntil) {
        return false;
      }
      
      // Unblock if block period expired
      if (metrics.isBlocked && metrics.blockUntil && now >= metrics.blockUntil) {
        metrics.isBlocked = false;
        metrics.blockUntil = undefined;
        metrics.errorCount = 0;
        console.log(`🔓 Key ${this.maskKey(key)} unblocked after cooldown period`);
      }
      
      return true;
    });
  }

  /**
   * 🚨 Mark key as rate-limited (429 error)
   */
  private markKeyAsRateLimited(apiKey: string): void {
    const metrics = this.keyMetrics.get(apiKey);
    if (metrics) {
      metrics.isBlocked = true;
      metrics.blockUntil = new Date(Date.now() + this.blockDurationMs);
      metrics.errorCount++;
      
      console.log(`🚫 Key ${this.maskKey(apiKey)} rate-limited, blocked until ${metrics.blockUntil.toISOString()}`);
    }
  }

  /**
   * ❌ Mark key as having an error
   */
  private markKeyError(apiKey: string): void {
    const metrics = this.keyMetrics.get(apiKey);
    if (metrics) {
      metrics.errorCount++;
      
      // Block key if too many errors
      if (metrics.errorCount >= this.maxErrorsBeforeBlock) {
        metrics.isBlocked = true;
        metrics.blockUntil = new Date(Date.now() + this.blockDurationMs * 2); // Longer block for repeated errors
        console.log(`🔒 Key ${this.maskKey(apiKey)} blocked due to ${metrics.errorCount} consecutive errors`);
      }
    }
  }

  /**
   * ✅ Mark key as successful (reset error count)
   */
  private markKeySuccess(apiKey: string): void {
    const metrics = this.keyMetrics.get(apiKey);
    if (metrics) {
      metrics.errorCount = 0; // Reset error count on success
    }
  }

  /**
   * 🔍 Check if error is a rate limit error
   */
  private isRateLimitError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return errorMessage.includes('429') || 
           errorMessage.includes('rate limit') || 
           errorMessage.includes('quota') ||
           errorMessage.includes('too many requests');
  }

  /**
   * 🔑 Get the last used API key
   */
  private getLastUsedKey(): string | null {
    let lastUsedKey: string | null = null;
    let latestTime = new Date(0);

    this.keyMetrics.forEach((metrics, key) => {
      if (metrics.lastUsed > latestTime) {
        latestTime = metrics.lastUsed;
        lastUsedKey = key;
      }
    });

    return lastUsedKey;
  }

  /**
   * 🎭 Mask API key for logging (show only first 8 and last 4 characters)
   */
  private maskKey(key: string): string {
    if (key.length <= 12) return '***';
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  }

  /**
   * 😴 Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 🧹 Start periodic cleanup task to unblock expired keys
   */
  private startCleanupTask(): void {
    setInterval(() => {
      const now = new Date();
      let unblocked = 0;

      this.keyMetrics.forEach((metrics, key) => {
        if (metrics.isBlocked && metrics.blockUntil && now >= metrics.blockUntil) {
          metrics.isBlocked = false;
          metrics.blockUntil = undefined;
          metrics.errorCount = 0;
          unblocked++;
        }
      });

      if (unblocked > 0) {
        console.log(`🧹 Cleanup: Unblocked ${unblocked} API keys`);
      }
    }, 30000); // Run every 30 seconds
  }

  /**
   * 📊 Get current status of all keys
   */
  public getStatus(): {
    totalKeys: number;
    availableKeys: number;
    blockedKeys: number;
    keyStats: Array<{
      key: string;
      usageCount: number;
      lastUsed: string;
      isBlocked: boolean;
      errorCount: number;
    }>;
  } {
    const availableKeys = this.getAvailableKeys();
    const keyStats = Array.from(this.keyMetrics.entries()).map(([key, metrics]) => ({
      key: this.maskKey(key),
      usageCount: metrics.usageCount,
      lastUsed: metrics.lastUsed.toISOString(),
      isBlocked: metrics.isBlocked,
      errorCount: metrics.errorCount
    }));

    return {
      totalKeys: this.keys.length,
      availableKeys: availableKeys.length,
      blockedKeys: this.keys.length - availableKeys.length,
      keyStats
    };
  }
}

// Lazy initialization to ensure environment variables are loaded
let geminiKeyManagerInstance: GeminiKeyManager | null = null;

export const getGeminiKeyManager = (env?: any): GeminiKeyManager => {
  if (!geminiKeyManagerInstance) {
    geminiKeyManagerInstance = new GeminiKeyManager(env);
  }
  return geminiKeyManagerInstance;
};
