import { GoogleGenAI } from '@google/genai';
import textSeImage from 'text-se-image';
import { ImageService, PollationsModel, GeminiModel, ApiError } from '../types';

/**
 * Google Gemini AI instance
 */
let ai: GoogleGenAI | null = null;

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
 * Initialize Google Gemini AI client
 */
export const initializeAi = (apiKey: string): void => {
  if (!apiKey) {
    throw new ApiError('An API key is required to initialize the AI service.');
  }
  ai = new GoogleGenAI({ apiKey });
};

/**
 * Get initialized Gemini AI client
 */
export const getAi = (): GoogleGenAI => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      initializeAi(apiKey);
      return ai!;
    }
    const error = new ApiError('Gemini AI client has not been initialized. Please provide an API key.');
    error.statusCode = 500;
    throw error;
  }
  return ai;
};

/**
 * Convert ArrayBuffer to Base64 string
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const uint8Array = new Uint8Array(buffer);
  const binaryString = Array.from(uint8Array)
    .map((byte) => String.fromCharCode(byte))
    .join('');
  return Buffer.from(binaryString, 'binary').toString('base64');
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
    
    // Generate image URL using text-se-image package
    const imageUrl = await textSeImage(finalPrompt, { id: modelId });
    
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
 * Generate image using Google Gemini AI
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
    
    // Get Gemini AI client
    const gemini = getAi();
    
    // Generate image
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
      throw new ApiError('No image returned from Gemini', 500, 'GEMINI_NO_IMAGE');
    }

    const imageBytes = response.generatedImages[0].image.imageBytes;
    console.log(`✅ Gemini image generated successfully (${imageBytes.length} chars)`);
    
    return imageBytes;
    
  } catch (error) {
    console.error('❌ Error in generateImageWithGemini:', error);
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    const apiError = new ApiError('Failed to generate image with Gemini AI.');
    apiError.statusCode = 500;
    throw apiError;
  }
};
