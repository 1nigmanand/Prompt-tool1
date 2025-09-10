import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import textSeImage from 'text-se-image';
import { 
  ImageGenerationRequest, 
  ImageGenerationResponse, 
  LocalImageRequest, 
  ApiError,
  ImageService,
  PollationsModel,
  GeminiModel
} from '../types/index.js';
import { getGeminiKeyManager } from '../services/geminiKeyManager.js';

/**
 * Google Gemini AI instance cache
 */
const aiInstances: Map<string, GoogleGenAI> = new Map();

/**
 * Service to model mapping for Pollinations AI
 */
const POLLINATIONS_MODEL_MAP: Record<string, PollationsModel> = {
  'pollinations-flux': 'flux',           
  'pollinations-kontext': 'realistic',   
  'pollinations-krea': 'anime',          
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
 * Generate image using Pollinations AI
 */
const generateImageWithPollinations = async (
  prompt: string, 
  service: ImageService = 'pollinations-flux'
): Promise<string> => {
  const modelId = POLLINATIONS_MODEL_MAP[service] || 'flux';
  const finalPrompt = prompt + PROMPT_ENHANCERS.default;
  
  console.log(`🎨 Generating image with Pollinations (${modelId}): "${finalPrompt}"`);
  
  const imageUrl = await textSeImage(finalPrompt, { id: modelId });
  const response = await fetch(imageUrl);
  
  if (!response.ok) {
    throw new ApiError(`Failed to fetch generated image: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  
  console.log(`✅ Pollinations image generated successfully (${base64.length} chars)`);
  return base64;
};

/**
 * 🚀 Generate image using Google Gemini AI with intelligent key rotation
 */
const generateImageWithGemini = async (
  prompt: string,
  service: ImageService = 'gemini-imagen-3'
): Promise<string> => {
  const enhancer = service === 'gemini-imagen-4-fast' 
    ? PROMPT_ENHANCERS['gemini-imagen-4-fast']
    : service === 'gemini-imagen-4-ultra'
    ? PROMPT_ENHANCERS['gemini-imagen-4-ultra']
    : PROMPT_ENHANCERS.default;
  
  const finalPrompt = prompt + enhancer;
  
  console.log(`🎨 Generating image with Gemini (${GEMINI_MODEL}): "${finalPrompt}"`);
  
  // 🔑 Use GeminiKeyManager for intelligent key rotation
  const imageBytes = await getGeminiKeyManager().executeWithRetry(async (apiKey) => {
    const gemini = getGeminiClient(apiKey);
    
    const response = await gemini.models.generateImages({
      model: GEMINI_MODEL,
      prompt: finalPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

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
};

/**
 * Validate image generation request
 */
const validateImageRequest = (body: any): ImageGenerationRequest => {
  if (!body.prompt || typeof body.prompt !== 'string') {
    throw new ApiError('Prompt is required and must be a string', 400, 'INVALID_PROMPT');
  }

  if (body.prompt.trim().length === 0) {
    throw new ApiError('Prompt cannot be empty', 400, 'EMPTY_PROMPT');
  }

  if (body.prompt.length > 2000) {
    throw new ApiError('Prompt is too long (max 2000 characters)', 400, 'PROMPT_TOO_LONG');
  }

  return {
    prompt: body.prompt.trim(),
    service: body.service || 'pollinations-flux',
    apiKey: body.apiKey
  };
};

/**
 * Validate local image request
 */
const validateLocalImageRequest = (body: any): LocalImageRequest => {
  if (!body.imageUrl || typeof body.imageUrl !== 'string') {
    throw new ApiError('Image URL is required and must be a string', 400, 'INVALID_IMAGE_URL');
  }

  return {
    imageUrl: body.imageUrl.trim()
  };
};

/**
 * Generate image using AI services with GeminiKeyManager
 */
export const generateImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, service, apiKey } = validateImageRequest(req.body);

    console.log(`🎯 Image generation request: service=${service}, prompt="${prompt.substring(0, 50)}..."`);

    // Generate image based on service type
    let imageBase64: string;
    if (service.startsWith('gemini-')) {
      imageBase64 = await generateImageWithGemini(prompt, service);
    } else if (service.startsWith('pollinations-')) {
      imageBase64 = await generateImageWithPollinations(prompt, service);
    } else {
      // Default to Gemini for unknown services
      console.log(`⚠️ Unknown service '${service}', defaulting to Gemini`);
      imageBase64 = await generateImageWithGemini(prompt, 'gemini-imagen-3');
    }

    // Determine model name for response
    let model: string;
    if (service.startsWith('pollinations-')) {
      model = 'Pollinations AI';
    } else if (service.startsWith('gemini-')) {
      model = 'Google Gemini Imagen';
    } else {
      model = 'AI Image Generator';
    }

    const response: ImageGenerationResponse = {
      success: true,
      imageBase64,
      model,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Image generated successfully using ${model}`);
    res.json(response);

  } catch (error) {
    console.error('❌ Error generating image:', error);
    
    if (error instanceof ApiError) {
      const response: ImageGenerationResponse = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(error.statusCode || 500).json(response);
    } else {
      const response: ImageGenerationResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate image',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
};

/**
 * Get local image and convert to base64
 */
export const getLocalImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl } = validateLocalImageRequest(req.body);

    console.log(`📷 Local image request: ${imageUrl}`);

    // Get origin from request headers to determine frontend URL
    const origin = req.headers.origin || req.headers.referer?.split('/').slice(0, 3).join('/') || 'http://localhost:5173';
    
    // Construct full URL for local images
    const fullImageUrl = imageUrl.startsWith('/') 
      ? `${origin}${imageUrl}` 
      : `${origin}/${imageUrl}`;
    
    console.log(`🔗 Fetching from: ${fullImageUrl}`);
    
    const response = await fetch(fullImageUrl);
    
    if (!response.ok) {
      throw new ApiError(
        `Failed to fetch image: ${response.statusText}`, 
        404, 
        'IMAGE_NOT_FOUND'
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    console.log(`✅ Local image loaded successfully (${base64.length} chars)`);

    res.json({
      success: true,
      imageBase64: base64,
      imageUrl,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching local image:', error);
    
    if (error instanceof ApiError) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch image',
        timestamp: new Date().toISOString()
      });
    }
  }
};
