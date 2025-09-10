import { GoogleGenAI } from '@google/genai';
import textSeImage from 'text-se-image';

let ai: GoogleGenAI | null = null;

export const initializeAi = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("An API key is required to initialize the AI service.");
  }
  ai = new GoogleGenAI({ apiKey });
};

export const getAi = (): GoogleGenAI => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      initializeAi(apiKey);
      return ai!;
    }
    throw new Error("Gemini AI client has not been initialized. Please provide an API key.");
  }
  return ai;
};

export const generateImageWithPollinations = async (
  prompt: string, 
  service: string = 'pollinations-flux'
): Promise<string> => {
  try {
    // Map service to text-se-image model ID
    let modelId = 'flux'; // default: High-quality image generation
    
    if (service === 'pollinations-kontext') {
      modelId = 'realistic'; // More photorealistic images
    } else if (service === 'pollinations-krea') {
      modelId = 'anime'; // Anime/manga style images
    }

    const finalPrompt = prompt + " Don't add any additional effects or styles";
    
    // Use text-se-image package to generate image URL
    const imageUrl = await textSeImage(finalPrompt, { id: modelId });
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = Array.from(uint8Array)
      .map((byte) => String.fromCharCode(byte))
      .join('');
    const base64 = Buffer.from(binaryString, 'binary').toString('base64');
    
    return base64;
  } catch (error) {
    console.error("Error in generateImageWithPollinations:", error);
    throw new Error("Failed to generate image. Please check your prompt or internet connection.");
  }
};

export const generateImageWithGemini = async (
  prompt: string,
  service: string = 'gemini-imagen-3'
): Promise<string> => {
  let finalPrompt = prompt;
  
  if (service === 'gemini-imagen-4-fast') {
    finalPrompt = prompt + ", simple, quick sketch, minimalist style. Don't add any additional effects or styles";
  } else if (service === 'gemini-imagen-4-ultra') {
    finalPrompt = prompt + ", ultra realistic, 4k, detailed, photorealistic. Don't add any additional effects or styles";
  } else {
    finalPrompt = prompt + " Don't add any additional effects or styles";
  }

  try {
    const gemini = getAi();
    const response = await gemini.models.generateImages({
      model: 'imagen-4.0-generate-001',
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
  } catch (error) {
    console.error("Error in generateImageWithGemini:", error);
    throw new Error("Failed to generate image with Gemini.");
  }
};
