import { Request, Response } from 'express';
import { generateImageWithPollinations, generateImageWithGemini, initializeAi } from '../services/imageService';
import { 
  ImageGenerationRequest, 
  ImageGenerationResponse, 
  LocalImageRequest, 
  ApiError 
} from '../types';

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
 * Generate image using AI services
 */
export const generateImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, service, apiKey } = validateImageRequest(req.body);

    console.log(`🎯 Image generation request: service=${service}, prompt="${prompt.substring(0, 50)}..."`);

    // Handle Gemini API key initialization
    if (service.startsWith('gemini-')) {
      if (apiKey) {
        initializeAi(apiKey);
      } else if (process.env.GEMINI_API_KEY) {
        initializeAi(process.env.GEMINI_API_KEY);
      } else {
        throw new ApiError(
          'API key is required for Gemini image generation. Please set GEMINI_API_KEY in server environment.',
          400,
          'MISSING_API_KEY'
        );
      }
    }

    // Generate image based on service type
    let imageBase64: string;
    let model: string;

    if (service.startsWith('pollinations-')) {
      imageBase64 = await generateImageWithPollinations(prompt, service);
      model = 'Pollinations AI';
    } else if (service.startsWith('gemini-')) {
      imageBase64 = await generateImageWithGemini(prompt, service);
      model = 'Google Gemini Imagen';
    } else {
      throw new ApiError('Unknown image service selected', 400, 'INVALID_SERVICE');
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

    // Construct full URL for local images
    const fullImageUrl = imageUrl.startsWith('/') 
      ? `http://localhost:5173${imageUrl}` 
      : `http://localhost:5173/${imageUrl}`;
    
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
