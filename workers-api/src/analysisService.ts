import { GoogleGenAI } from '@google/genai';
import { AnalysisResult, User, Challenge } from './types';
import { getGeminiKeyManager } from './geminiKeyManager';

/**
 * Google Gemini AI instance cache
 */
const aiInstances: Map<string, GoogleGenAI> = new Map();

/**
 * 🔑 Get or create Gemini AI client for specific API key
 */
const getGeminiClient = (apiKey: string): GoogleGenAI => {
  if (!aiInstances.has(apiKey)) {
    aiInstances.set(apiKey, new GoogleGenAI({ apiKey }));
  }
  return aiInstances.get(apiKey)!;
};

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
    1. A similarity score (0-100) - be strict but fair
    2. 2-3 quirky feedback suggestions with actionable prompt improvements`;

    const userTurnPrompt = `
    Challenge Name: "${challenge.name}"
    Challenge Description: "${challenge.description}"
    The student ${userName} generated this image using their prompt.
    Student's Prompt: "${userPrompt}"
    
    Compare the TARGET IMAGE (first image - what they should match) with the GENERATED IMAGE (second image - what they actually created).
    
    Grade strictly based on:
    1. Challenge-specific requirements fulfillment
    2. Technical quality and detail level
    3. Prompt accuracy to image output
    
    Return JSON with:
    - similarityScore: number (0-100, be strict!)
    - feedback: array of 2-3 quirky suggestions for improvement`;

    // 🔑 Use GeminiKeyManager for intelligent key rotation and retry logic
    const analysisResponse = await getGeminiKeyManager().executeWithRetry(async (apiKey: string) => {
      // Get AI client for this specific key
      const gemini = getGeminiClient(apiKey);
      
      // Prepare image parts
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
      console.log(`📤 Sending analysis request to Gemini...`);

      const responseSchema = {
        type: "object",
        properties: {
          similarityScore: {
            type: "number",
            description: 'A similarity score from 0-100 comparing the generated image to the target image.',
          },
          feedback: {
            type: "array",
            items: {
              type: "string",
            },
            description: 'An array of up to 3 strings with quirky, entertaining, and helpful prompt improvement suggestions. Use playful Indian English, be sarcastic when appropriate, but always provide actionable advice.',
          },
        },
        required: ['similarityScore', 'feedback'],
      };

      // Analyze images with current key
      return await gemini.models.generateContent({
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
    }, 'image-analysis');

    const jsonText = analysisResponse.text?.trim() || '';
    if (!jsonText) {
      throw new Error("Empty response from Gemini API");
    }

    console.log(`📝 Raw Gemini response: ${jsonText}`);

    let analysisResult: AnalysisResult;
    try {
      const parsed = JSON.parse(jsonText);
      analysisResult = {
        similarityScore: Math.min(100, Math.max(0, Math.round(parsed.similarityScore || 0))),
        feedback: Array.isArray(parsed.feedback) ? parsed.feedback : ['Analysis failed, but keep trying! 🤖'],
        detailedAnalysis: {
          colorMatch: 50,
          shapeMatch: 50,
          compositionMatch: 50,
          overallQuality: 50
        },
      };
    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response as JSON:', parseError);
      console.log('Raw response that failed to parse:', jsonText);
      
      // Fallback analysis result
      analysisResult = {
        similarityScore: 50,
        feedback: [
          `Arre ${userName}! 😅 Something went wrong with the analysis, but don't worry!`,
          "Try making your prompt more specific and detailed, boss! 🎯",
          "Add more descriptive words about colors, shapes, and style preferences! ✨"
        ],
        detailedAnalysis: {
          colorMatch: 50,
          shapeMatch: 50,
          compositionMatch: 50,
          overallQuality: 50
        },
      };
    }

    console.log(`✅ Analysis completed - Score: ${analysisResult.similarityScore}%`);
    console.log(`💬 Feedback points: ${analysisResult.feedback.length}`);
    
    return analysisResult;
    
  } catch (error) {
    console.error('❌ Error in analyzeImages:', error);
    
    // Enhanced error handling for better debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analysis error details:', errorMessage);
    
    // Return a fallback result instead of throwing
    return {
      similarityScore: 30,
      feedback: [
        "Oops! 😅 The analysis system had a little hiccup, but don't let that stop you!",
        "Try a simpler, more direct prompt and see what magic happens! ✨",
        "Sometimes the best art comes from the most unexpected mistakes! 🎨"
      ],
      detailedAnalysis: {
        colorMatch: 30,
        shapeMatch: 30,
        compositionMatch: 30,
        overallQuality: 30
      },
    };
  }
};
