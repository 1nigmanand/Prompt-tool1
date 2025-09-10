import { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { AnalysisRequest, AnalysisResponse, ApiError, AnalysisResult, User, Challenge } from '../types/index.js';
import { getGeminiKeyManager } from '../services/geminiKeyManager.js';

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

/**
 * Analyze images using Gemini AI with intelligent key rotation
 */
const analyzeImages = async (
  user: User,
  challenge: Challenge,
  generatedImageBase64: string,
  userPrompt: string,
  targetImageBase64: string
): Promise<AnalysisResult> => {
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

  // 🔑 Use GeminiKeyManager for intelligent key rotation
  const analysisResponse = await getGeminiKeyManager().executeWithRetry(async (apiKey) => {
    const gemini = getGeminiClient(apiKey);
    
    const targetImagePart = {
      inlineData: { data: targetImageBase64, mimeType: "image/jpeg" }
    };
    
    const generatedImagePart = {
      inlineData: { data: generatedImageBase64, mimeType: "image/jpeg" }
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
          items: { type: Type.STRING },
          description: 'An array of up to 3 strings with quirky, entertaining, and helpful prompt improvement suggestions.',
        },
      },
      required: ['similarityScore', 'feedback'],
    };

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

  try {
    const parsed = JSON.parse(jsonText);
    return {
      similarityScore: Math.min(100, Math.max(0, Math.round(parsed.similarityScore || 0))),
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : ['Analysis failed, but keep trying! 🤖'],
      detailedAnalysis: {
        colorMatch: 50, shapeMatch: 50, compositionMatch: 50, overallQuality: 50
      },
    };
  } catch (parseError) {
    console.error('❌ Failed to parse Gemini response as JSON:', parseError);
    return {
      similarityScore: 50,
      feedback: [
        `Arre ${userName}! 😅 Something went wrong with the analysis, but don't worry!`,
        "Try making your prompt more specific and detailed, boss! 🎯",
        "Add more descriptive words about colors, shapes, and style preferences! ✨"
      ],
      detailedAnalysis: {
        colorMatch: 50, shapeMatch: 50, compositionMatch: 50, overallQuality: 50
      },
    };
  }
};

/**
 * Validate analysis request
 */
const validateAnalysisRequest = (body: any): AnalysisRequest => {
  // Validate user
  if (!body.user || typeof body.user !== 'object') {
    throw new ApiError('User object is required', 400, 'INVALID_USER');
  }
  
  if (!body.user.email || typeof body.user.email !== 'string') {
    throw new ApiError('User email is required and must be a string', 400, 'INVALID_USER_EMAIL');
  }

  // Validate challenge
  if (!body.challenge || typeof body.challenge !== 'object') {
    throw new ApiError('Challenge object is required', 400, 'INVALID_CHALLENGE');
  }
  
  if (!body.challenge.name || !body.challenge.description) {
    throw new ApiError('Challenge name and description are required', 400, 'INVALID_CHALLENGE_DATA');
  }

  // Validate generated image
  if (!body.generatedImageBase64 || typeof body.generatedImageBase64 !== 'string') {
    throw new ApiError('Generated image base64 is required', 400, 'INVALID_GENERATED_IMAGE');
  }

  return {
    user: body.user,
    challenge: body.challenge,
    generatedImageBase64: body.generatedImageBase64
  };
};

/**
 * Analyze image comparison between generated and target images
 */
export const analyzeImageComparison = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user, challenge, generatedImageBase64 } = validateAnalysisRequest(req.body);
    const { userPrompt, targetImageBase64, apiKey } = req.body;

    console.log(`🔍 Analysis request: user=${user.email}, challenge="${challenge.name}"`);
    console.log(`📸 Generated image length: ${generatedImageBase64 ? generatedImageBase64.length : 'MISSING'}`);
    console.log(`🎯 Target image length: ${targetImageBase64 ? targetImageBase64.length : 'MISSING'}`);
    console.log(`💬 User prompt: "${userPrompt}"`);

    // Validate that both images are present
    if (!targetImageBase64) {
      throw new ApiError('Target image is required for comparison', 400, 'MISSING_TARGET_IMAGE');
    }

    if (!generatedImageBase64) {
      throw new ApiError('Generated image is required for comparison', 400, 'MISSING_GENERATED_IMAGE');
    }

    console.log('🤖 Starting image analysis with GeminiKeyManager...');
    
    const analysisResult = await analyzeImages(
      user,
      challenge,
      generatedImageBase64,
      userPrompt,
      targetImageBase64
    );

    // Validate analysis result
    if (!analysisResult || typeof analysisResult.similarityScore !== 'number') {
      throw new ApiError('Invalid analysis result received', 500, 'INVALID_ANALYSIS_RESULT');
    }

    const response: AnalysisResponse = {
      success: true,
      result: analysisResult,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Analysis completed: similarity=${analysisResult.similarityScore}%`);
    res.json(response);

  } catch (error) {
    console.error('❌ Error analyzing images:', error);
    
    if (error instanceof ApiError) {
      const response: AnalysisResponse = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      res.status(error.statusCode || 500).json(response);
    } else {
      const response: AnalysisResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze images',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
};
