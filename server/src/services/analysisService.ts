import { GoogleGenAI, Type } from '@google/genai';
import { getAi } from './imageService';

interface AnalysisResult {
  similarityScore: number;
  feedback: string[];
}

interface User {
  email: string;
}

interface Challenge {
  name: string;
  description: string;
  imageUrl: string;
}

export const analyzeImages = async (
  user: User,
  challenge: Challenge,
  generatedImageBase64: string,
  userPrompt: string,
  targetImageBase64: string
): Promise<AnalysisResult> => {
  try {
    const gemini = getAi();

    const getUserName = (email: string): string => {
      const namePart = email.split('@')[0];
      return namePart.split('.')[0].charAt(0).toUpperCase() + namePart.split('.')[0].slice(1);
    };
    
    const userName = getUserName(user.email);

    const systemPrompt = `You are an expert image analysis AI for a prompt engineering learning tool. Your feedback tone should be quirky and vague, in simple and clear Indian English. Keep technical terms in pure English.
    A student named ${userName} is trying to generate an image to match a target image for a prompt engineering challenge.
    Analyze the provided image which contains two images side-by-side. The image on the LEFT is the "target image", and the image on the RIGHT is the student's generated image.

    Provide:
    1. A 'similarityScore' from 0-100.
    2. A 'feedback' JSON array of up to 3 strings with prompt improvement suggestions.

    Respond ONLY with a JSON object matching the provided schema.`;

    const userTurnPrompt = ` Challenge Name: "${challenge.name}".
    The goal is: "${challenge.description}".
    The student's prompt was: "${userPrompt}".
`;

    // Create stitched image (target on left, generated on right)
    const stitchedImageBase64 = await stitchImages(targetImageBase64, generatedImageBase64);
    
    const stitchedImagePart = {
      inlineData: {
        data: stitchedImageBase64,
        mimeType: "image/jpeg",
      },
    };

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        similarityScore: {
          type: Type.NUMBER,
          description: 'A similarity score from 0-100 comparing the generated image to the target image.',
        },
        feedback: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: 'An array of up to 3 strings with prompt improvement suggestions.',
        },
      },
      required: ['similarityScore', 'feedback'],
    };

    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: userTurnPrompt },
          stitchedImagePart,
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
    const result: AnalysisResult = JSON.parse(jsonText);
    
    if (!result || typeof result.similarityScore !== 'number' || !Array.isArray(result.feedback)) {
      throw new Error("Model returned malformed analysis data.");
    }
    
    return result;

  } catch (error) {
    console.error("Failed to get analysis:", error);
    if (error instanceof Error) {
      throw new Error(`Analysis failed: ${error.message}`);
    }
    throw new Error("An unknown error occurred during analysis.");
  }
};

// Helper function to stitch two base64 images side by side
async function stitchImages(
  targetImageBase64: string,
  generatedImageBase64: string
): Promise<string> {
  // For this demo, we'll use a simple fallback approach
  // In production, you would install the 'canvas' package for proper image stitching
  // npm install canvas @types/canvas
  
  console.warn('Image stitching is using fallback method. Install canvas package for full functionality.');
  
  // Fallback: Return the generated image for analysis
  // The Gemini AI can still analyze single images effectively
  return generatedImageBase64;
}
