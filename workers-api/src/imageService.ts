import { GoogleGenAI } from '@google/genai';
// import textSeImage from 'text-se-image'; // Not available in Workers
import { ImageService, PollationsModel, GeminiModel, ApiError } from './types';
import { getGeminiKeyManager } from './geminiKeyManager.js';

/**
 * Google Gemini AI instance cache
 */
const aiInstances: Map<string, GoogleGenAI> = new Map();

/**
 * Service to model mapping for Pollinations AI
 */
const POLLINATIONS_MODEL_MAP: Record<string, PollationsModel> = {
  'pollinations-flux': 'flux',           // High-quality image generation (default)
  'pollinations-kontext': 'realistic',   // More photorealistic images
  'pollinations-krea': 'anime',          // Anime/manga style images
} as const;

/**
 * Gemini model configuration
 */
const GEMINI_MODEL: GeminiModel = 'imagen-3.0-generate-002';

/**
 * Prompt enhancement based on service type
 */
const PROMPT_ENHANCERS = {
  'gemini-imagen-4-fast': ', simple, quick sketch, minimalist style. Don\'t add any additional effects or styles',
  'gemini-imagen-4-ultra': ', ultra realistic, 4k, detailed, photorealistic. Don\'t add any additional effects or styles',
  default: ' Don\'t add any additional effects or styles'
} as const;

/**
 * 🔑 Get or create Gemini AI client for specific API key
 */
const getGeminiClient = (apiKey: string): GoogleGenAI => {
  if (!aiInstances.has(apiKey)) {
    aiInstances.set(apiKey, new GoogleGenAI({ apiKey }));
  }
  return aiInstances.get(apiKey)!;
};

/**
 * @deprecated Legacy function - use GeminiKeyManager instead
 * Initialize Google Gemini AI client
 */
export const initializeAi = (apiKey: string): void => {
  console.log('⚠️ Warning: initializeAi is deprecated. Using GeminiKeyManager for key rotation.');
  if (!apiKey) {
    throw new ApiError('An API key is required to initialize the AI service.');
  }
  // Create instance for backward compatibility
  getGeminiClient(apiKey);
};

/**
 * @deprecated Legacy function - use GeminiKeyManager instead
 * Get initialized Gemini AI client
 */
export const getAi = (env?: any): GoogleGenAI => {
  console.log('⚠️ Warning: getAi is deprecated. Using GeminiKeyManager for key rotation.');
  
  // Fallback to legacy behavior
  const apiKey = env?.GEMINI_API_KEY || env?.GEMINI_API_KEYS?.split(',')[0];
  if (apiKey) {
    return getGeminiClient(apiKey);
  }
  
  const error = new ApiError('Gemini AI client has not been initialized. Please provide an API key.');
  error.statusCode = 500;
  throw error;
};

/**
 * Convert ArrayBuffer to Base64 string
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const uint8Array = new Uint8Array(buffer);
  const binaryString = Array.from(uint8Array)
    .map((byte) => String.fromCharCode(byte))
    .join('');
  return btoa(binaryString);
};

/**
 * Generate image using Pollinations AI via text-se-image package
 */
export const generateImageWithPollinations = async (
  prompt: string, 
  service: ImageService = 'pollinations-flux'
): Promise<string> => {
  try {
    // Get model ID from service mapping
    const modelId = POLLINATIONS_MODEL_MAP[service] || 'flux';
    
    // Enhance prompt with default styling instructions
    const finalPrompt = prompt + PROMPT_ENHANCERS.default;
    
    console.log(`🎨 Generating image with Pollinations (${modelId}): "${finalPrompt}"`);
    
    // Generate image URL using direct Pollinations API
    const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(finalPrompt)}?model=${modelId}&width=1024&height=1024`;
    
    // Fetch the generated image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new ApiError(`Failed to fetch generated image: ${response.statusText}`);
    }
    
    // Convert to base64
    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    
    console.log(`✅ Pollinations image generated successfully (${base64.length} chars)`);
    return base64;
    
  } catch (error) {
    console.error('❌ Error in generateImageWithPollinations:', error);
    const apiError = new ApiError('Failed to generate image with Pollinations. Please check your prompt or internet connection.');
    apiError.statusCode = 500;
    throw apiError;
  }
};

/**
 * 🚀 Generate image using Google Gemini AI with intelligent key rotation
 */
export const generateImageWithGemini = async (
  prompt: string,
  service: ImageService = 'gemini-imagen-3'
): Promise<string> => {
  try {
    // Get prompt enhancer based on service type
    const enhancer = service === 'gemini-imagen-4-fast' 
      ? PROMPT_ENHANCERS['gemini-imagen-4-fast']
      : service === 'gemini-imagen-4-ultra'
      ? PROMPT_ENHANCERS['gemini-imagen-4-ultra']
      : PROMPT_ENHANCERS.default;
    
    const finalPrompt = prompt + enhancer;
    
    console.log(`🎨 Generating image with Gemini (${GEMINI_MODEL}): "${finalPrompt}"`);
    
    // 🔑 Use GeminiKeyManager for intelligent key rotation and retry logic
    const imageBytes = await getGeminiKeyManager().executeWithRetry(async (apiKey: string) => {
      // Get AI client for this specific key
      const gemini = getGeminiClient(apiKey);
      
      // Generate image with current key
      const response = await gemini.models.generateImages({
        model: GEMINI_MODEL,
        prompt: finalPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
      });

      // Validate response
      if (!response.generatedImages || 
          response.generatedImages.length === 0 || 
          !response.generatedImages[0] ||
          !response.generatedImages[0].image ||
          !response.generatedImages[0].image.imageBytes) {
        throw new Error('No image returned from Gemini');
      }

      return response.generatedImages[0].image.imageBytes;
    }, 'image-generation');

    console.log(`✅ Gemini image generated successfully (${imageBytes.length} chars)`);
    return imageBytes;
    
  } catch (error) {
    console.error('❌ Error in generateImageWithGemini:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Enhanced error handling for better debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const apiError = new ApiError(`Failed to generate image with Gemini AI: ${errorMessage}`);
    apiError.statusCode = 500;
    throw apiError;
  }
};

/**
 * Main image generation function that routes to the appropriate service
 */
export const generateImage = async (prompt: string, service: ImageService = 'gemini-imagen-3'): Promise<string> => {
  console.log(`🎯 Image generation request - Service: ${service}, Prompt: "${prompt}"`);
  
  try {
    // Route to appropriate service based on service type
    if (service.startsWith('gemini-')) {
      return await generateImageWithGemini(prompt, service);
    } else if (service.startsWith('pollinations-')) {
      return await generateImageWithPollinations(prompt, service);
    } else {
      // Default to Gemini for unknown services
      console.log(`⚠️ Unknown service '${service}', defaulting to Gemini`);
      return await generateImageWithGemini(prompt, 'gemini-imagen-3');
    }
  } catch (error) {
    console.error('❌ Error in generateImage:', error);
    throw error;
  }
};
