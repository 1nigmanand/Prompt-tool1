import { AnalysisResult, Challenge, User } from '../types';
import { API_ENDPOINTS } from '../config/api';

// Backend API configuration (now auto-detects local vs production)
const API_BASE_URL = API_ENDPOINTS.API;

// --- Analysis Service Logic ---

export const analyzeImages = async (
  user: User,
  challenge: Challenge,
  generatedImageBase64: string,
  userPrompt: string,
): Promise<AnalysisResult> => {
  try {
    console.log(`📊 Client Analysis - Starting process`);
    console.log(`🎮 Challenge: "${challenge.name}" - ${challenge.imageUrl}`);
    console.log(`💬 User prompt: "${userPrompt}"`);
    console.log(`📸 Generated image length: ${generatedImageBase64?.length || 0}`);
    
    // Get target image as base64
    console.log(`🎯 Fetching target image from: ${challenge.imageUrl}`);
    const targetImageBase64 = await getTargetImageAsBase64(challenge.imageUrl);
    console.log(`✅ Target image fetched successfully: ${targetImageBase64?.length || 0} characters`);

    console.log(`📤 Sending request to backend with both images...`);

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
      throw new Error(errorData.error || 'Failed to analyze images');
    }

    const data = await response.json();
    
    console.log('📊 Analysis response from backend:', data);
    
    // Handle new backend response structure
    if (data.success && data.result) {
      // Return the result directly with added legacy support
      const result: AnalysisResult = {
        similarityScore: data.result.similarityScore || 0,
        feedback: data.result.feedback || [],
        // Legacy support for components expecting old format
        similarity: data.result.similarityScore || 0,
        passed: (data.result.similarityScore || 0) >= 80
      };
      
      console.log('✅ Processed analysis result:', result);
      return result;
    } else {
      throw new Error(data.error || 'Invalid response format from analysis service');
    }

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