import { Request, Response } from 'express';
import { analyzeImages } from '../services/analysisService';
import { initializeAi } from '../services/imageService';
import { AnalysisRequest, AnalysisResponse, ApiError } from '../types';

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

    // Initialize AI if apiKey is provided
    if (apiKey) {
      initializeAi(apiKey);
    } else if (!process.env.GEMINI_API_KEY) {
      throw new ApiError(
        'API key is required for image analysis. Please set GEMINI_API_KEY in server environment.',
        400,
        'MISSING_API_KEY'
      );
    }

    console.log('🤖 Starting image analysis...');
    
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
