/**
 * Type definitions for the server application
 */

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

export type ImageService = 
  | 'pollinations-flux' 
  | 'pollinations-kontext' 
  | 'pollinations-krea' 
  | 'gemini-imagen-3' 
  | 'gemini-imagen-4-fast' 
  | 'gemini-imagen-4-ultra';

export type PollationsModel = 'flux' | 'realistic' | 'anime' | 'flux-schnell' | 'turbo' | 'majestic';

export type GeminiModel = 'imagen-3.0-generate-001' | 'imagen-3.0-generate-002' | 'imagen-4.0-generate-001';

export interface User {
  email: string;
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

export class ApiError extends Error {
  public statusCode?: number;
  public code?: string;

  constructor(message: string, statusCode?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

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
  displayName: string;
  photoURL: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
  totalChallengesCompleted: number;
  totalScore: number;
  currentStreak: number;
  maxStreak: number;
  isActive: boolean;
}

// Challenge Progress Types
export enum ChallengeStatus {
  LOCKED = 'locked',
  UNLOCKED = 'unlocked',
  COMPLETED = 'completed'
}

export interface ChallengeProgress {
  status: ChallengeStatus;
  streak: number;
  previousSimilarityScore: number;
  completedAt?: Date;
  attempts?: number;
  bestScore?: number;
}

// User Statistics
export interface UserStats {
  userId: string;
  totalChallengesCompleted: number;
  totalScore: number;
  currentStreak: number;
  maxStreak: number;
  averageScore: number;
  lastChallengeAt: Date;
  updatedAt: Date;
}

// User Profile Update Type
export interface UserProfileUpdate {
  displayName?: string;
  photoURL?: string;
  email?: string;
}
