/**
 * Complete Type definitions for the workers API application
 * Based on server implementation
 */

// Image Service Types
export type ImageService = 
  | 'pollinations-flux' 
  | 'pollinations-kontext' 
  | 'pollinations-krea' 
  | 'gemini-imagen-3' 
  | 'gemini-imagen-4-fast' 
  | 'gemini-imagen-4-ultra';

export type PollationsModel = 'flux' | 'realistic' | 'anime' | 'flux-schnell' | 'turbo' | 'majestic';

export type GeminiModel = 'imagen-3.0-generate-001' | 'imagen-3.0-generate-002' | 'imagen-4.0-generate-001';

// Core Domain Types
export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt?: Date;
  lastLoginAt?: Date;
}

export interface Challenge {
  id: number;
  name: string;
  imageUrl: string;
  description: string;
}

export interface AnalysisResult {
  similarityScore: number;
  feedback: string[];
  similarity?: number; // Legacy support
  passed?: boolean;    // Legacy support
  detailedAnalysis?: {
    colorMatch?: number;
    shapeMatch?: number;
    compositionMatch?: number;
    overallQuality?: number;
  };
}

// Error Handling
export class ApiError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    
    // Ensure proper prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Request/Response Interfaces
export interface ImageGenerationRequest {
  prompt: string;
  service: ImageService;
  apiKey?: string;
}

export interface ImageGenerationResponse {
  success: boolean;
  imageBase64?: string;
  error?: string;
  model?: string;
  timestamp?: string;
}

export interface LocalImageRequest {
  imageUrl: string;
}

export interface AnalysisRequest {
  user: User;
  challenge: Challenge;
  generatedImageBase64: string;
}

export interface AnalysisResponse {
  success: boolean;
  result?: AnalysisResult;
  error?: string;
  timestamp?: string;
}

export interface HealthResponse {
  status: 'OK' | 'ERROR';
  timestamp: string;
  service: string;
  version?: string;
}

// Configuration
export interface ServiceConfig {
  geminiApiKey?: string;
  environment: 'development' | 'production' | 'test';
  corsOrigin: string;
  port: number;
}

// Firebase User Document Type
export interface UserDocument {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt?: Date;
  lastLoginAt?: Date;
  updatedAt?: Date; // For service compatibility
  stats?: UserStats;
  progress?: UserProgress;
}

// User Statistics
export interface UserStats {
  userId?: string; // For service compatibility
  totalChallengesAttempted: number;
  totalChallengesCompleted: number;
  averageSimilarityScore: number;
  averageScore?: number; // Alternative name for compatibility
  bestSimilarityScore: number;
  totalTimeSpent: number; // in minutes
  streak: number;
  currentStreak?: number; // Alternative name for compatibility
  maxStreak?: number; // Additional property
  level: number;
  experiencePoints: number;
  totalScore?: number; // For leaderboard
  lastChallengeAt?: Date; // When last challenge was completed
  updatedAt?: Date; // When stats were last updated
}

// User Progress
export interface UserProgress {
  currentChallenge: number;
  challengesStatus: ChallengeStatus[];
  unlockedChallenges: number[];
  completedChallenges: CompletedChallenge[];
}

// Challenge Progress (for compatibility)
export interface ChallengeProgress {
  challengeId: number;
  status: string;
  attempts: number;
  bestScore?: number;
  completedAt?: Date;
  streak?: number; // For service compatibility
  previousSimilarityScore?: number; // For service compatibility
}

// User Profile Update (for compatibility)
export interface UserProfileUpdate {
  displayName?: string;
  photoURL?: string;
}

// Challenge Status
export enum ChallengeStatusEnum {
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
  COMPLETED = 'completed'
}

export interface ChallengeStatus {
  challengeId: number;
  status: ChallengeStatusEnum;
  attempts: number;
  bestScore?: number;
  completedAt?: Date;
}

// Completed Challenge
export interface CompletedChallenge {
  challengeId: number;
  completedAt: Date;
  similarityScore: number;
  timeSpent: number; // in minutes
  attempts: number;
  userPrompt: string;
}

// Challenge Attempt
export interface ChallengeAttempt {
  id: string;
  userId: string;
  challengeId: number;
  userPrompt: string;
  generatedImageBase64: string;
  similarityScore: number;
  feedback: string[];
  createdAt: Date;
  timeSpent?: number; // in minutes
}

// Leaderboard Entry
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  photoURL?: string;
  totalScore: number;
  completedChallenges: number;
  averageScore: number;
  rank: number;
}

// User Profile Update Request
export interface UserProfileUpdateRequest {
  displayName?: string;
  photoURL?: string;
}

// User Stats Update
export interface UserStatsUpdate {
  challengeId: number;
  similarityScore: number;
  timeSpent: number;
  completed: boolean;
}

// Firebase REST API Response Types
export interface FirestoreDocument {
  name: string;
  fields: Record<string, any>;
  createTime: string;
  updateTime: string;
}

export interface FirestoreCollection {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}
