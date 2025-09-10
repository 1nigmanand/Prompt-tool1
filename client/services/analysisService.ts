import { AnalysisResult, Challenge, User } from '../types';

// Backend API configuration
const API_BASE_URL = (process as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api';

// --- Analysis Service Logic ---

export const analyzeImages = async (
  user: User,
  challenge: Challenge,
  generatedImageBase64: string,
  userPrompt: string,
): Promise<AnalysisResult> => {
  try {
    // Get target image as base64
    const targetImageBase64 = await getTargetImageAsBase64(challenge.imageUrl);

    const response = await fetch(`${API_BASE_URL}/analysis/compare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user,
        challenge,
        generatedImageBase64,
        userPrompt,
        targetImageBase64,
        apiKey: localStorage.getItem('gemini_api_key')
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to analyze images');
    }

    const data = await response.json();
    return data.analysis;

  } catch (error) {
    console.error("Failed to get analysis:", error);
    if (error instanceof Error) {
        throw new Error(`Analysis failed: ${error.message}`);
    }
    throw new Error("An unknown error occurred during analysis.");
  }
};

// Helper function to convert local image URL to base64
async function getTargetImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch target image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = Array.from(uint8Array).map((byte) => String.fromCharCode(byte)).join('');
    return btoa(binaryString);
  } catch (error) {
    console.error('Error converting target image to base64:', error);
    throw new Error('Failed to process target image');
  }
}