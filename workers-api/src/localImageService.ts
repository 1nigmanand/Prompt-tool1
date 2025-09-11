/**
 * 📷 Local Image Service for Cloudflare Workers
 * Fetches challenge images and converts them to base64
 */

import { ApiError } from './types';

export interface LocalImageRequest {
  imageUrl: string;
}

export interface LocalImageResponse {
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  timestamp: string;
  error?: string;
}

/**
 * Validate local image request
 */
export const validateLocalImageRequest = (body: any): LocalImageRequest => {
  if (!body.imageUrl || typeof body.imageUrl !== 'string') {
    throw new ApiError('Image URL is required and must be a string', 400, 'INVALID_IMAGE_URL');
  }

  return {
    imageUrl: body.imageUrl.trim()
  };
};

/**
 * Convert ArrayBuffer to Base64 string for Workers environment
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const uint8Array = new Uint8Array(buffer);
  const binaryString = Array.from(uint8Array)
    .map((byte) => String.fromCharCode(byte))
    .join('');
  
  // In Workers environment, use btoa instead of Buffer
  return btoa(binaryString);
};

/**
 * Get local image and convert to base64
 */
export const getLocalImage = async (
  request: LocalImageRequest,
  originHeader?: string
): Promise<LocalImageResponse> => {
  try {
    const { imageUrl } = request;

    console.log(`📷 Local image request: ${imageUrl}`);

    // Get origin from request headers to determine frontend URL
    const origin = originHeader || 'https://prompt-proj1.web.app';
    
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
    const base64 = arrayBufferToBase64(arrayBuffer);

    console.log(`✅ Local image loaded successfully (${base64.length} chars)`);

    return {
      success: true,
      imageBase64: base64,
      imageUrl,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error fetching local image:', error);
    
    throw error instanceof ApiError ? error : new ApiError(
      `Failed to fetch image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'IMAGE_FETCH_FAILED'
    );
  }
};
