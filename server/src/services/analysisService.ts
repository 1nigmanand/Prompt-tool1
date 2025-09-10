import { GoogleGenAI, Type } from '@google/genai';
import { getAi } from './imageService';
import { AnalysisResult, User, Challenge } from '../types';

export const analyzeImages = async (
  user: User,
  challenge: Challenge,
  generatedImageBase64: string,
  userPrompt: string,
  targetImageBase64: string
): Promise<AnalysisResult> => {
  try {
    console.log(`🤖 Analysis Service - Starting image comparison`);
    console.log(`📸 Generated image received: ${generatedImageBase64 ? 'YES' : 'NO'} (length: ${generatedImageBase64?.length || 0})`);
    console.log(`🎯 Target image received: ${targetImageBase64 ? 'YES' : 'NO'} (length: ${targetImageBase64?.length || 0})`);
    console.log(`💬 User prompt: "${userPrompt}"`);
    console.log(`🎮 Challenge: "${challenge.name}" - ${challenge.description}`);

    if (!targetImageBase64) {
      throw new Error('Target image is missing in analysis service');
    }

    if (!generatedImageBase64) {
      throw new Error('Generated image is missing in analysis service');
    }

    const gemini = getAi();

    const getUserName = (email: string): string => {
      const namePart = email.split('@')[0];
      return namePart.split('.')[0].charAt(0).toUpperCase() + namePart.split('.')[0].slice(1);
    };
    
    const userName = getUserName(user.email);

    const systemPrompt = `You are an expert image analysis AI for a prompt engineering learning tool. Your feedback should be quirky, fun, and slightly sarcastic in simple Indian English mixed with Hindi words. Keep technical terms in pure English but make the tone entertaining and memorable.
    
    A student named ${userName} is trying to generate an image to match a challenge requirement.
    
    IMPORTANT ANALYSIS RULES:
    1. Check if the generated image matches the SPECIFIC challenge requirements
    2. For "Simple Shape" - Look for basic geometric shapes (circle, square, triangle)
    3. For "Object with Background" - Look for objects WITH detailed surroundings, textures, and lighting
    4. For "Creative Portrait" - Look for people/faces with artistic elements
    5. For "Nature Scene" - Look for landscapes, trees, animals in natural settings
    6. For "Abstract Art" - Look for non-representational artistic elements
    7. For "Architecture" - Look for buildings, structures, architectural details
    
    Be STRICT about challenge-specific requirements! A simple red circle for "Object with Background" should get 40-70% because it lacks textures, lighting details, and proper background description.

    PERSONALITY TRAITS:
    - Use quirky expressions like "Arre yaar", "Bhai", "Boss", "Dekho ji"
    - Be playfully sarcastic when they're completely wrong
    - Use emoji-like expressions in text like "😅", "🤔" 
    - Mix Hindi-English naturally
    - Be encouraging but honest about mistakes
    - Make jokes about obvious mismatches

    FEEDBACK RULES:
    1. If content is COMPLETELY WRONG (e.g., dog for "Simple Shape"), be playfully dramatic about it
    2. Give specific, actionable prompts with quirky explanations
    3. Use fun analogies and comparisons
    4. Keep it light-hearted but helpful

    Provide:
    1. A 'similarityScore' from 0-100.
    2. A 'feedback' JSON array of up to 3 strings with quirky, entertaining prompt improvement suggestions.

    Respond ONLY with a JSON object matching the provided schema.`;

    const userTurnPrompt = `Challenge Name: "${challenge.name}".
    Challenge Goal: "${challenge.description}".
    Student's Prompt: "${userPrompt}".
    
    IMPORTANT: You have been provided with TWO images:
    1. TARGET IMAGE - This is what the student should match (challenge reference)
    2. GENERATED IMAGE - This is what the student actually created using their prompt
    
    Compare the GENERATED image with the TARGET image and score based on how well they match according to the challenge requirements.
    
    SCORING GUIDE - Be strict but quirky:
    - "Simple Shape" challenge: Dogs, people, complex scenes = 10-30% (with funny roasting)
      Perfect geometric shapes matching target = 80-100% (with celebration)
      Close attempts = 40-70% (with encouraging jokes)
    
    - "Object with Background" challenge: Wrong objects = 10-40%
      Correct objects without texture/lighting = 40-70%
      Objects with basic background but missing textures = 50-75%
      Perfect match with detailed textures, lighting, and surroundings = 80-100%
    
    - Other challenges: Match the target image requirements closely for 80-100%
      Partial matches = 50-79%, Wrong content = 10-40%
    
    The student ${userName} generated this image using their prompt. 
    
    Give them quirky, memorable feedback that's both funny and helpful. Roast them playfully if they're way off, celebrate if they're close!`;

    // Send both images separately to Gemini for accurate comparison
    console.log(`🚀 Preparing images for Gemini analysis...`);
    
    const targetImagePart = {
      inlineData: {
        data: targetImageBase64,
        mimeType: "image/jpeg",
      },
    };
    
    const generatedImagePart = {
      inlineData: {
        data: generatedImageBase64,
        mimeType: "image/jpeg",
      },
    };

    console.log(`✅ Target image part created: ${targetImagePart.inlineData.data ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Generated image part created: ${generatedImagePart.inlineData.data ? 'SUCCESS' : 'FAILED'}`);
    console.log(`📤 Sending ${5} parts to Gemini: [Target label, Target image, Generated label, Generated image, Prompt]`);

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
          description: 'An array of up to 3 strings with quirky, entertaining, and helpful prompt improvement suggestions. Use playful Indian English, be sarcastic when appropriate, but always provide actionable advice.',
        },
      },
      required: ['similarityScore', 'feedback'],
    };

    const response = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: "TARGET IMAGE (what student should match):" },
          targetImagePart,
          { text: "GENERATED IMAGE (what student actually created):" },
          generatedImagePart,
          { text: userTurnPrompt },
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
    
    console.log('🔍 Gemini analysis response:', jsonText);
    
    const result: AnalysisResult = JSON.parse(jsonText);
    
    if (!result || typeof result.similarityScore !== 'number' || !Array.isArray(result.feedback)) {
      console.error('❌ Malformed analysis data:', result);
      throw new Error("Model returned malformed analysis data.");
    }
    
    console.log('✅ Analysis result validated:', { 
      similarityScore: result.similarityScore, 
      feedbackCount: result.feedback.length,
      targetImageUsed: !!targetImageBase64,
      generatedImageUsed: !!generatedImageBase64
    });
    
    return result;

  } catch (error) {
    console.error("Failed to get analysis:", error);
    if (error instanceof Error) {
      throw new Error(`Analysis failed: ${error.message}`);
    }
    throw new Error("An unknown error occurred during analysis.");
  }
};
