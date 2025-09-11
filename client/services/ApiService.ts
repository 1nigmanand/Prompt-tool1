import { ImageService } from '../types';
import { API_ENDPOINTS } from '../config/api';

// Backend API configuration (now auto-detects local vs production)
const API_BASE_URL = API_ENDPOINTS.BASE;

// Health check function to verify backend connection
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(API_BASE_URL.replace('/api', '/health'));
    return response.ok;
  } catch (error) {
    console.error('Backend health check failed:', error);
    return false;
  }
};

// Initialize AI (now handled by backend) - keeping for compatibility
export const initializeAi = (apiKey: string) => {
  // Store API key for backend requests (optional, backend can use env vars)
  localStorage.setItem('gemini_api_key', apiKey);
};

export const getAi = () => {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    throw new Error("Gemini AI client has not been initialized. Please provide an API key.");
  }
  return { apiKey };
};

export const generateImage = async (prompt: string, service: ImageService = 'pollinations-flux'): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/images/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        service,
        apiKey: localStorage.getItem('gemini_api_key')
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to generate image');
    }

    const data = await response.json();
    return data.imageBase64;

  } catch (error) {
    console.error("Error in generateImage:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to generate image. Please check your prompt or internet connection.");
  }
};

/**
 * Fetches an image from a local URL and returns it as base64.
 * This now calls the backend to get local images.
 * @param url The local URL of the image (e.g., '/challenges/challenge-1.jpg')
 * @returns A promise that resolves to a base64 string
 */
export const getLocalImageAsBlobUrl = async (url: string): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/images/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUrl: url }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${url}. Status: ${response.statusText}`);
    }

    const data = await response.json();
    // Convert base64 to blob URL for display
    const base64Data = data.imageBase64;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error(`Error fetching local image ${url}:`, error);
    // Fallback to the original URL if fetching fails
    return url;
  }
};