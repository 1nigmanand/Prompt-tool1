import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { GoogleGenAI } from '@google/genai';
import { getLocalImage, validateLocalImageRequest } from './localImageService';

// Import new modular components
import userRoutes from './routes/userRoutes';
import statusRoutes from './routes/statusRoutes';
import imageRoutes from './routes/imageRoutes';
import analysisRoutes from './routes/analysisRoutes';
import { requestLogger, errorHandler } from './middleware/errorHandler';
import { healthCheck } from './controllers/statusController';
import { initializeFirebaseWorkers } from './config/firebase';

// Import types
import {
  ImageService,
  PollationsModel,
  GeminiModel,
  User,
  Challenge,
  AnalysisRequest,
  ImageGenerationRequest
} from './types';

// Re-export existing interface definitions for backward compatibility
interface LocalUser {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

interface LocalChallenge {
  id: string;
  name: string;
  description: string;
  targetImage: string;
}

interface LocalAnalysisRequest {
  user: LocalUser;
  challenge: LocalChallenge;
  generatedImageBase64: string;
  userPrompt: string;
  targetImageBase64: string;
}

interface LocalImageGenerationRequest {
  prompt: string;
  provider?: 'gemini' | 'pollinations';
  service?: ImageService;  // Client compatibility
  model?: string;
  size?: string;
  apiKey?: string;  // Client compatibility
}

interface AnalysisResult {
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

// Enhanced Error class for better error handling
class ApiError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Key Metrics interface for tracking API key performance
interface KeyMetrics {
  key: string;
  usageCount: number;
  lastUsed: Date;
  isBlocked: boolean;
  blockUntil?: Date;
  errorCount: number;
}

// Enhanced Gemini Key Manager Class with server-level functionality
class GeminiKeyManager {
  private apiKeys: string[] = [];
  private keyMetrics: Map<string, KeyMetrics> = new Map();
  private currentIndex: number = 0;
  private readonly maxRetries: number = 3;
  private readonly blockDurationMs: number = 60000; // 1 minute block for rate-limited keys
  private readonly maxErrorsBeforeBlock: number = 5;

  constructor(env?: any) {
    this.initializeKeys(env);
    this.startCleanupTask();
    console.log(`🔑 GeminiKeyManager initialized with ${this.apiKeys.length} API keys`);
  }

  /**
   * Initialize API keys from environment variables
   */
  private initializeKeys(env?: any): void {
    // Debug environment
    console.log('🔍 Environment object keys:', Object.keys(env || {}));
    console.log('🔍 GEMINI_API_KEYS type:', typeof env?.GEMINI_API_KEYS);
    console.log('🔍 GEMINI_API_KEYS value:', env?.GEMINI_API_KEYS ? 'EXISTS' : 'MISSING');
    
    // Try to get keys from environment first
    if (env?.GEMINI_API_KEYS && typeof env.GEMINI_API_KEYS === 'string') {
      this.apiKeys = env.GEMINI_API_KEYS.split(',').map((key: string) => key.trim()).filter((key: string) => key.length > 0);
      console.log(`🔑 ✅ Loaded ${this.apiKeys.length} API keys from environment secrets`);
    } else {
      // Fallback to hardcoded keys
      this.apiKeys = [
        'AIzaSyCILukDVZrdV1QX0EuoBAZVIbg66E6M9ho',
        'AIzaSyDWEcTe0qR1DRGV7FKvM_HDrcZmQb1fmUU',
        'AIzaSyBZqyNKJOLBJRJFLTz8ZNJNPEHuW1SJf5o',
        'AIzaSyDKdS4dQRjNfHKvI8PMcR5ThSZXBjYRHDE',
        'AIzaSyC1zG4A7N0HtJdKcS8lFmWt2VgNJPdR0qE',
        'AIzaSyBZMlNWJtVhX2qF8KjR5PLdyG0NrQzFBcK',
        'AIzaSyB4qLNcZbU8WjT6VmRnK2FhGpSdPeYyXoI',
        'AIzaSyDXcPtGfRjNhJ8LKvI5QmW9sVyBtUzEaOp',
        'AIzaSyClMnZxBvN6HsP8VtJdR2KqFgW0yLpEuTs',
        'AIzaSyCsNpKvL5OcFrE3GjT7RmW8XzQaBhYdUtK',
        'AIzaSyBfJtLvR9HnKpE2SqW6QmZ5oXrCgDyFaUt',
        'AIzaSyDpHvK6S8RjLtE5QmW9zXoFcGaBhYdUtKp',
        'AIzaSyBsJvR7HnKpE2SqW6QmZ5oXrCgDyFaUtKs'
      ];
      console.log(`🔑 ⚠️ Using ${this.apiKeys.length} fallback API keys - env not available`);
    }

    if (this.apiKeys.length === 0) {
      throw new ApiError('🚨 No Gemini API keys found in environment variables', 500, 'NO_API_KEYS');
    }

    // Initialize metrics for each key
    this.apiKeys.forEach(key => {
      this.keyMetrics.set(key, {
        key,
        usageCount: 0,
        lastUsed: new Date(0),
        isBlocked: false,
        errorCount: 0
      });
    });
  }

  /**
   * Get next available API key using round-robin rotation
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
   * Execute API call with automatic retry and key rotation
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
   * Get all currently available (non-blocked) keys
   */
  private getAvailableKeys(): string[] {
    const now = new Date();
    return this.apiKeys.filter(key => {
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
   * Mark key as rate-limited (429 error)
   */
  private markKeyAsRateLimited(apiKey: string): void {
    const metrics = this.keyMetrics.get(apiKey);
    if (metrics) {
      metrics.isBlocked = true;
      metrics.blockUntil = new Date(Date.now() + this.blockDurationMs);
      metrics.errorCount++;
    }
  }

  /**
   * Mark key as having an error
   */
  private markKeyError(apiKey: string): void {
    const metrics = this.keyMetrics.get(apiKey);
    if (metrics) {
      metrics.errorCount++;
      if (metrics.errorCount >= this.maxErrorsBeforeBlock) {
        metrics.isBlocked = true;
        metrics.blockUntil = new Date(Date.now() + this.blockDurationMs);
        console.log(`🚨 Key ${this.maskKey(apiKey)} blocked after ${this.maxErrorsBeforeBlock} errors`);
      }
    }
  }

  /**
   * Mark key as successful (reset error count)
   */
  private markKeySuccess(apiKey: string): void {
    const metrics = this.keyMetrics.get(apiKey);
    if (metrics) {
      metrics.errorCount = 0;
      metrics.lastUsed = new Date();
    }
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('429') || 
           message.includes('rate limit') || 
           message.includes('quota exceeded') ||
           message.includes('too many requests');
  }

  /**
   * Get the last used key (for error tracking)
   */
  private getLastUsedKey(): string | null {
    let lastUsedKey: string | null = null;
    let lastUsedTime = 0;

    for (const [key, metrics] of this.keyMetrics) {
      if (metrics.lastUsed.getTime() > lastUsedTime) {
        lastUsedTime = metrics.lastUsed.getTime();
        lastUsedKey = key;
      }
    }

    return lastUsedKey;
  }

  /**
   * Mask API key for logging
   */
  private maskKey(key: string): string {
    if (key.length <= 8) return '***';
    return key.substring(0, 4) + '***' + key.substring(key.length - 4);
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 🧹 Start cleanup task to unblock expired keys
   */
  private startCleanupTask(): void {
    // Don't start cleanup in Workers environment as it may not persist
    if (typeof self !== 'undefined' && 'WorkerGlobalScope' in self) {
      console.log('⚠️ Skipping cleanup task in Workers environment');
      return;
    }
    
    setInterval(() => {
      const now = new Date();
      let unblocked = 0;
      
      for (const [key, metrics] of this.keyMetrics) {
        if (metrics.isBlocked && metrics.blockUntil && now >= metrics.blockUntil) {
          metrics.isBlocked = false;
          metrics.blockUntil = undefined;
          metrics.errorCount = 0;
          unblocked++;
          console.log(`🔓 Key ${this.maskKey(key)} unblocked after cooldown period`);
        }
      }
      
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
      totalKeys: this.apiKeys.length,
      availableKeys: availableKeys.length,
      blockedKeys: this.apiKeys.length - availableKeys.length,
      keyStats
    };
  }
}

// Initialize Hono app with proper environment bindings
const app = new Hono<{ 
  Bindings: { 
    GEMINI_API_KEYS: string;
    FIREBASE_PROJECT_ID: string;
    FIREBASE_PRIVATE_KEY: string;
    FIREBASE_CLIENT_EMAIL: string;
  } 
}>();

// Global instance - will be initialized with environment in the first request
let geminiKeyManager: GeminiKeyManager | null = null;

// Helper function to get or initialize GeminiKeyManager
function getGeminiKeyManager(env: any): GeminiKeyManager {
  if (!geminiKeyManager) {
    geminiKeyManager = new GeminiKeyManager(env);
  }
  return geminiKeyManager;
}

// CORS middleware
app.use('*', cors({
  origin: ['https://prompt-proj1.web.app', 'http://localhost:5173'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  exposeHeaders: ['Access-Control-Allow-Origin']
}));

// Logger middleware
app.use('*', logger());

// Middleware to initialize Gemini Key Manager with environment
app.use('*', async (c, next) => {
  // This ensures GeminiKeyManager is initialized with environment for each request
  getGeminiKeyManager(c.env);
  await next();
});

// Health check endpoint
app.get('/health', (c) => {
  // Log environment debugging info on health check
  console.log('🔍 Health endpoint - Environment keys:', Object.keys(c.env || {}));
  console.log('🔍 Health endpoint - GEMINI_API_KEYS available:', !!c.env?.GEMINI_API_KEYS);
  
  return c.json({
    success: true,
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'Prompt Tool Workers API',
      version: '1.0.0',
      environment: {
        hasGeminiKeys: !!c.env?.GEMINI_API_KEYS,
        keyCount: c.env?.GEMINI_API_KEYS ? c.env.GEMINI_API_KEYS.split(',').length : 0,
        availableEndpoints: [
          '/health',
          '/api/images/generate',
          '/api/images/local',
          '/api/analysis/compare',
          '/api/status/keys',
          '/api/status/keys/reset',
          '/api/users/profile',
          '/api/users/progress',
          '/api/users/stats',
          '/api/users/leaderboard'
        ]
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Request logger middleware
app.use('*', requestLogger);

// Mount modular routes
app.route('/api/users', userRoutes);
app.route('/api/status', statusRoutes);
// Note: Image and analysis routes are implemented inline below for now
// app.route('/api/images', imageRoutes);
// app.route('/api/analysis', analysisRoutes);

// Image generation endpoint
app.post('/api/images/generate', async (c) => {
  try {
    const body = await c.req.json() as LocalImageGenerationRequest;
    const { prompt, provider, service, apiKey } = body;

    // Handle client compatibility - map service to provider
    let finalProvider = provider || 'gemini'; // Default to gemini
    
    if (service) {
      // Map service types to providers for client compatibility
      if (service.includes('pollinations')) {
        finalProvider = 'pollinations';
      } else if (service.includes('gemini')) {
        finalProvider = 'gemini';
      }
    }

    if (!prompt || prompt.trim().length === 0) {
      return c.json({ 
        success: false,
        error: 'Prompt is required' 
      }, 400);
    }

    if (prompt.length > 2000) {
      return c.json({ 
        success: false,
        error: 'Prompt is too long (max 2000 characters)' 
      }, 400);
    }

    console.log(`🎨 Generating image with ${finalProvider} (service: ${service}):`, prompt);

    let imageBase64: string;
    let model: string;

    if (finalProvider === 'gemini') {
      // Generate with Gemini using enhanced key management
      const keyManager = getGeminiKeyManager(c.env);
      const result = await keyManager.executeWithRetry(async (apiKey) => {
        const gemini = new GoogleGenAI({ apiKey });
        
        console.log(`🎨 Attempting image generation with Gemini Imagen-3...`);
        const response = await gemini.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: prompt + '. Don\'t add any additional effects or styles',
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '1:1',
          },
        });

        if (!response.generatedImages?.[0]?.image?.imageBytes) {
          throw new ApiError('No image returned from Gemini', 500, 'NO_IMAGE_GENERATED');
        }

        return {
          imageBase64: response.generatedImages[0].image.imageBytes,
          model: 'Google Gemini Imagen-3'
        };
      }, 'image-generation');
      
      imageBase64 = result.imageBase64;
      model = result.model;
    } else {
      // Generate with Pollinations (with better error handling)
      try {
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true`;
        
        console.log(`🎨 Fetching image from Pollinations: ${imageUrl}`);
        const response = await fetch(imageUrl);
        
        if (!response.ok) {
          throw new ApiError(`Pollinations API failed: ${response.status} ${response.statusText}`, response.status, 'POLLINATIONS_API_ERROR');
        }
        
        const arrayBuffer = await response.arrayBuffer();
        imageBase64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        model = 'Pollinations AI';
        
      } catch (error) {
        console.error('❌ Pollinations generation failed:', error);
        throw new ApiError(
          'Failed to generate image with Pollinations',
          500,
          'POLLINATIONS_GENERATION_FAILED'
        );
      }
    }

    console.log(`✅ Image generated successfully with ${model}`);
    return c.json({
      success: true,
      imageBase64,
      provider: finalProvider,
      model,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Image generation error:', error);
    
    if (error instanceof ApiError) {
      return c.json({ 
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      }, error.statusCode as any);
    }
    
    return c.json({ 
      success: false,
      error: 'Failed to generate image',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Local image retrieval endpoint
app.post('/api/images/local', async (c) => {
  try {
    const body = await c.req.json();
    
    // Handle client format: { imageUrl: "/challenges/challenge-1.jpg" }
    const request = validateLocalImageRequest(body);
    const originHeader = c.req.header('origin');
    
    const result = await getLocalImage(request, originHeader);
    
    return c.json({
      success: result.success,
      imageBase64: result.imageBase64,
      imageUrl: result.imageUrl,
      timestamp: result.timestamp
    });
    
  } catch (error) {
    console.error('❌ Local image error:', error);
    
    if (error instanceof Error && 'statusCode' in error) {
      return c.json({ 
        success: false,
        error: error.message,
        code: (error as any).code || 'LOCAL_IMAGE_ERROR',
        timestamp: new Date().toISOString()
      }, (error as any).statusCode || 500);
    }
    
    return c.json({ 
      success: false,
      error: 'Failed to fetch local image',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'LOCAL_IMAGE_ERROR',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Image analysis endpoint
app.post('/api/analysis/compare', async (c) => {
  try {
    const body = await c.req.json() as LocalAnalysisRequest;
    const { 
      user, 
      challenge, 
      generatedImageBase64, 
      userPrompt, 
      targetImageBase64 
    } = body;

    // Validate required fields
    if (!generatedImageBase64) {
      return c.json({ 
        success: false,
        error: 'Generated image base64 is required',
        code: 'MISSING_GENERATED_IMAGE'
      }, 400);
    }

    if (!userPrompt) {
      return c.json({ 
        success: false,
        error: 'User prompt is required',
        code: 'MISSING_USER_PROMPT'
      }, 400);
    }

    if (!targetImageBase64) {
      return c.json({ 
        success: false,
        error: 'Target image base64 is required',
        code: 'MISSING_TARGET_IMAGE'
      }, 400);
    }

    console.log(`🧠 Analyzing images for challenge: ${challenge?.name || 'Unknown'}`);
    
    // Use Gemini for analysis
    const keyManager = getGeminiKeyManager(c.env);
    const analysis = await keyManager.executeWithRetry(async (apiKey) => {
      const gemini = new GoogleGenAI({ apiKey });
      
      const getUserName = (email: string): string => {
        const namePart = email.split('@')[0];
        return namePart.split('.')[0].charAt(0).toUpperCase() + namePart.split('.')[0].slice(1);
      };
      
      const userName = user?.email ? getUserName(user.email) : 'User';

      const systemPrompt = `You are an expert image analysis AI for a prompt engineering learning tool. Your feedback should be quirky, fun, and slightly sarcastic in simple Indian English mixed with Hindi words. Keep technical terms in pure English but make the tone entertaining and memorable.
      
      A student named ${userName} is trying to generate an image to match a challenge requirement.
      
      IMPORTANT ANALYSIS RULES:
      1. Check if the generated image matches the SPECIFIC challenge requirements
      2. For "Simple Shape" - Look for basic geometric shapes (circle, square, triangle)
      3. For "Object with Background" - Look for objects WITH detailed surroundings, textures, and lighting
      4. For "Creative Portrait" - Look for people/faces with artistic elements
      5. For "Nature Scene" - Look for landscapes, trees, animals in natural settings
      6. For "Abstract Art" - Look for non-representational artistic elements
      7. For "Architecture" - Look for buildings, structures, architectural details
      
      Be STRICT about challenge-specific requirements! A simple red circle for "Object with Background" should get 40-70% because it lacks textures, lighting details, and proper background description.

      PERSONALITY TRAITS:
      - Use quirky expressions like "Arre yaar", "Bhai", "Boss", "Dekho ji"
      - Be playfully sarcastic when they're completely wrong
      - Use emoji-like expressions in text like "😅", "🤔" 
      - Mix Hindi-English naturally
      - Be encouraging but honest about mistakes
      - Make jokes about obvious mismatches

      FEEDBACK RULES:
      1. If content is COMPLETELY WRONG (e.g., dog for "Simple Shape"), be playfully dramatic about it
      2. Give specific, actionable prompts with quirky explanations
      3. Use fun analogies and comparisons
      4. Keep it light-hearted but helpful

      Provide:
      1. A similarity score (0-100) - be strict but fair
      2. 2-3 quirky feedback suggestions with actionable prompt improvements`;

      const userTurnPrompt = `
      Challenge Name: "${challenge.name}"
      Challenge Description: "${challenge.description}"
      The student ${userName} generated this image using their prompt.
      Student's Prompt: "${userPrompt}"
      
      Compare the TARGET IMAGE (first image - what they should match) with the GENERATED IMAGE (second image - what they actually created).
      
      Grade strictly based on:
      1. Challenge-specific requirements fulfillment
      2. Technical quality and detail level
      3. Prompt accuracy to image output
      
      Return JSON with:
      - similarityScore: number (0-100, be strict!)
      - feedback: array of 2-3 quirky suggestions for improvement`;

      // Prepare image parts
      const targetImagePart = {
        inlineData: { data: targetImageBase64, mimeType: "image/jpeg" }
      };
      
      const generatedImagePart = {
        inlineData: { data: generatedImageBase64, mimeType: "image/jpeg" }
      };

      console.log(`✅ Target image part created: ${targetImagePart.inlineData.data ? 'SUCCESS' : 'FAILED'}`);
      console.log(`✅ Generated image part created: ${generatedImagePart.inlineData.data ? 'SUCCESS' : 'FAILED'}`);
      console.log(`📤 Sending analysis request to Gemini-2.5-flash...`);

      // Use structured response format with response schema (like server)
      const responseSchema = {
        type: 'object',
        properties: {
          similarityScore: {
            type: 'number',
            description: 'A similarity score from 0-100 comparing the generated image to the target image.',
          },
          feedback: {
            type: 'array',
            items: { type: 'string' },
            description: 'An array of up to 3 strings with quirky, entertaining, and helpful prompt improvement suggestions.',
          },
        },
        required: ['similarityScore', 'feedback'],
      };

      const response = await gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { text: "TARGET IMAGE (what student should match):" },
            targetImagePart,
            { text: "GENERATED IMAGE (what student actually created):" },
            generatedImagePart,
            { text: userTurnPrompt },
          ]
        },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });

      const jsonText = response.text?.trim() || '';
      if (!jsonText) {
        throw new Error("Empty response from Gemini API");
      }

      console.log(`📝 Raw Gemini response: ${jsonText}`);

      try {
        const parsed = JSON.parse(jsonText);
        return {
          similarityScore: Math.min(100, Math.max(0, Math.round(parsed.similarityScore || 0))),
          feedback: Array.isArray(parsed.feedback) ? parsed.feedback : ['Analysis failed, but keep trying! 🤖'],
          detailedAnalysis: {
            colorMatch: Math.round(parsed.similarityScore * 0.8) || 50,
            shapeMatch: Math.round(parsed.similarityScore * 0.9) || 50,
            compositionMatch: Math.round(parsed.similarityScore * 0.7) || 50,
            overallQuality: Math.round(parsed.similarityScore * 0.85) || 50
          }
        };
      } catch (parseError) {
        console.error('❌ Failed to parse Gemini response as JSON:', parseError);
        console.log('Raw response that failed to parse:', jsonText);
        
        // Fallback analysis result
        return {
          similarityScore: 50,
          feedback: [
            `Arre ${userName}! 😅 Something went wrong with the analysis, but don't worry!`,
            "Try making your prompt more specific and detailed, boss! 🎯",
            "Add more descriptive words about colors, shapes, and style preferences! ✨"
          ],
          detailedAnalysis: {
            colorMatch: 50,
            shapeMatch: 50,
            compositionMatch: 50,
            overallQuality: 50
          }
        };
      }
    }, 'image-analysis');

    console.log(`✅ Analysis completed successfully`);
    
    // Return in client-expected format
    return c.json({
      success: true,
      result: {
        similarityScore: analysis.similarityScore,
        feedback: analysis.feedback,
        // Legacy support
        similarity: analysis.similarityScore,
        passed: analysis.similarityScore >= 80,
        detailedAnalysis: analysis.detailedAnalysis
      },
      // Additional metadata
      challengeInfo: {
        id: challenge.id,
        name: challenge.name,
        description: challenge.description
      },
      userInfo: {
        prompt: userPrompt,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Analysis error:', error);
    
    if (error instanceof ApiError) {
      return c.json({ 
        success: false,
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString()
      }, error.statusCode as any);
    }
    
    return c.json({ 
      success: false,
      error: 'Failed to analyze images',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'ANALYSIS_FAILED',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Status endpoint for key manager
app.get('/api/status/keys', async (c) => {
  try {
    console.log('📊 Key Manager Status Request');
    
    const keyManager = getGeminiKeyManager(c.env);
    const status = keyManager.getStatus();
    
    return c.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        keyManager: {
          totalKeys: status.totalKeys,
          availableKeys: status.availableKeys,
          blockedKeys: status.blockedKeys,
          keyStats: status.keyStats.map(stat => ({
            key: stat.key, // Already masked in getStatus()
            usageCount: stat.usageCount,
            lastUsed: stat.lastUsed,
            isBlocked: stat.isBlocked,
            errorCount: stat.errorCount
          }))
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting key manager status:', error);
    return c.json({
      success: false,
      error: 'Failed to get key manager status',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'STATUS_ERROR',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Reset key manager metrics endpoint
app.post('/api/status/keys/reset', async (c) => {
  try {
    console.log('🔄 Key Manager Metrics Reset Request');
    
    // Note: Reset functionality not implemented in current Workers GeminiKeyManager
    // This would require adding a resetMetrics method to the GeminiKeyManager class
    
    return c.json({
      success: true,
      message: 'Reset functionality not implemented yet - metrics will auto-cleanup over time',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error resetting key manager metrics:', error);
    return c.json({
      success: false,
      error: 'Failed to reset key manager metrics',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'RESET_ERROR',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// User Profile Routes
app.get('/api/users/profile', async (c) => {
  try {
    console.log('📝 Getting user profile...');
    
    // Mock user profile data based on server structure
    const mockUser = {
      id: 'worker-user-123',
      email: 'worker@example.com',
      displayName: 'Worker API User',
      photoURL: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      totalChallengesCompleted: Math.floor(Math.random() * 10),
      averageScore: Math.floor(Math.random() * 100),
      currentStreak: Math.floor(Math.random() * 5),
      maxStreak: Math.floor(Math.random() * 10),
      settings: {
        theme: 'dark',
        notifications: true,
        difficulty: 'medium'
      }
    };

    return c.json({
      success: true,
      data: mockUser,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Get profile error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to get user profile',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

app.post('/api/users/profile', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📝 Creating/updating user profile:', body);
    
    const mockCreatedUser = {
      ...body,
      id: 'worker-user-' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      totalChallengesCompleted: 0,
      averageScore: 0,
      currentStreak: 0,
      maxStreak: 0
    };
    
    return c.json({
      success: true,
      data: mockCreatedUser,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Create profile error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to create user profile',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

app.patch('/api/users/profile', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📝 Updating user profile:', body);
    
    const mockUpdatedUser = {
      ...body,
      id: 'worker-user-123',
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    return c.json({
      success: true,
      data: mockUpdatedUser,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Update profile error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to update user profile',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

app.delete('/api/users/profile', async (c) => {
  try {
    console.log('🗑️ Deleting user profile');
    
    return c.json({
      success: true,
      message: 'User profile deleted successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Delete profile error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to delete user profile',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// User Progress Routes
app.get('/api/users/progress', async (c) => {
  try {
    console.log('📈 Getting user progress...');
    
    // Generate realistic mock progress data
    const mockChallengesCompleted = Array.from({ length: Math.floor(Math.random() * 5) }, (_, i) => ({
      challengeId: `challenge-${i + 1}`,
      completedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      score: Math.floor(Math.random() * 100),
      attempts: Math.floor(Math.random() * 3) + 1,
      timeSpent: Math.floor(Math.random() * 3600) + 300, // 5 minutes to 1 hour
      bestPrompt: `A creative prompt for challenge ${i + 1}`
    }));

    return c.json({
      success: true,
      data: {
        userId: 'worker-user-123',
        challengesCompleted: mockChallengesCompleted,
        currentChallenge: Math.floor(Math.random() * 6) + 1,
        totalScore: mockChallengesCompleted.reduce((sum, c) => sum + c.score, 0),
        averageScore: mockChallengesCompleted.length > 0 
          ? Math.round(mockChallengesCompleted.reduce((sum, c) => sum + c.score, 0) / mockChallengesCompleted.length)
          : 0,
        lastActivityAt: new Date().toISOString(),
        streak: {
          current: Math.floor(Math.random() * 5),
          max: Math.floor(Math.random() * 10) + 1,
          lastStreakDate: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Get progress error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to get user progress',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

app.post('/api/users/progress', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📈 Saving user progress:', body);
    
    // Mock saving progress data
    const savedProgress = {
      ...body,
      userId: 'worker-user-123',
      lastActivityAt: new Date().toISOString(),
      savedAt: new Date().toISOString()
    };
    
    return c.json({
      success: true,
      data: savedProgress,
      message: 'Progress saved successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Save progress error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to save user progress',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// User Stats Routes
app.get('/api/users/stats', async (c) => {
  try {
    console.log('📊 Getting user stats...');
    
    // Generate realistic mock stats
    const totalChallenges = Math.floor(Math.random() * 15);
    const totalScore = totalChallenges * (Math.floor(Math.random() * 50) + 50);
    const lastWeekActivity = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      challengesCompleted: Math.floor(Math.random() * 3),
      averageScore: Math.floor(Math.random() * 100),
      timeSpent: Math.floor(Math.random() * 7200) // up to 2 hours
    }));

    return c.json({
      success: true,
      data: {
        userId: 'worker-user-123',
        totalChallengesCompleted: totalChallenges,
        averageScore: totalChallenges > 0 ? Math.round(totalScore / totalChallenges) : 0,
        currentStreak: Math.floor(Math.random() * 5),
        maxStreak: Math.floor(Math.random() * 10) + 1,
        totalPromptsGenerated: totalChallenges * (Math.floor(Math.random() * 3) + 1),
        favoritePromptType: ['creative', 'technical', 'artistic', 'nature'][Math.floor(Math.random() * 4)],
        lastWeekActivity,
        achievements: [
          { id: 'first_generation', name: 'First Generation', unlockedAt: new Date().toISOString() },
          { id: 'creative_master', name: 'Creative Master', unlockedAt: new Date().toISOString() }
        ],
        totalTimeSpent: lastWeekActivity.reduce((sum, day) => sum + day.timeSpent, 0),
        improvementRate: Math.floor(Math.random() * 30) + 5 // 5-35% improvement
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Get stats error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to get user stats',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

app.post('/api/users/stats/update', async (c) => {
  try {
    const body = await c.req.json();
    console.log('📊 Updating user stats:', body);
    
    // Mock updating stats
    const updatedStats = {
      ...body,
      userId: 'worker-user-123',
      lastUpdatedAt: new Date().toISOString(),
      version: Math.floor(Math.random() * 100) + 1
    };
    
    return c.json({
      success: true,
      data: updatedStats,
      message: 'Stats updated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Update stats error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to update user stats',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Leaderboard Route
app.get('/api/users/leaderboard', async (c) => {
  try {
    console.log('🏆 Getting leaderboard...');
    
    // Generate realistic mock leaderboard data
    const mockLeaderboard = Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      userId: `user-${Math.random().toString(36).substr(2, 9)}`,
      displayName: [
        'PromptMaster', 'CreativeGenius', 'AIWhisperer', 'ImageWizard', 'PromptNinja',
        'ArtisticSoul', 'TechGuru', 'VisualMagic', 'PromptSage', 'PixelPioneer'
      ][i] || `User${i + 1}`,
      totalScore: Math.floor(Math.random() * 1000) + (10 - i) * 100, // Higher scores for top ranks
      challengesCompleted: Math.floor(Math.random() * 20) + (10 - i) * 2,
      averageScore: Math.floor(Math.random() * 30) + 70, // 70-100 range
      currentStreak: Math.floor(Math.random() * 15) + (10 - i),
      lastActivity: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      badges: Math.floor(Math.random() * 5) + 1,
      country: ['🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇩🇪', '🇫🇷', '🇯🇵', '🇮🇳', '🇧🇷', '🇰🇷'][i] || '🌍'
    })).sort((a, b) => b.totalScore - a.totalScore);

    return c.json({
      success: true,
      data: {
        leaderboard: mockLeaderboard,
        currentUserRank: Math.floor(Math.random() * 50) + 11, // User not in top 10
        totalParticipants: Math.floor(Math.random() * 1000) + 500,
        lastUpdated: new Date().toISOString(),
        period: 'all-time' // could be 'weekly', 'monthly', 'all-time'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Get leaderboard error:', error);
    return c.json({ 
      success: false,
      error: 'Failed to get leaderboard',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${c.req.method} ${c.req.url}`,
    code: 'ROUTE_NOT_FOUND',
    availableRoutes: [
      'GET /health',
      'POST /api/images/generate',
      'POST /api/images/local',
      'POST /api/analysis/compare',
      'GET /api/status/keys',
      'POST /api/status/keys/reset',
      'GET /api/users/profile',
      'POST /api/users/profile',
      'PATCH /api/users/profile',
      'DELETE /api/users/profile',
      'GET /api/users/progress',
      'POST /api/users/progress',
      'GET /api/users/stats',
      'POST /api/users/stats/update',
      'GET /api/users/leaderboard'
    ],
    timestamp: new Date().toISOString()
  }, 404);
});

// Error handler
app.onError((error, c) => {
  console.error('❌ Unhandled error:', error);
  
  if (error instanceof ApiError) {
    return c.json({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    }, error.statusCode as any);
  }
  
  return c.json({
    success: false,
    error: 'Internal server error',
    message: error.message,
    code: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString()
  }, 500);
});

export default app;
