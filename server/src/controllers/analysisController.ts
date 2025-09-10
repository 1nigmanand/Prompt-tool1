import { Request, Response } from 'express';
import { analyzeImages } from '../services/analysisService';
import { initializeAi } from '../services/imageService';

export const analyzeImageComparison = async (req: Request, res: Response) => {
  try {
    const { 
      user, 
      challenge, 
      generatedImageBase64, 
      userPrompt, 
      targetImageBase64,
      apiKey 
    } = req.body;

    // Validate required fields
    if (!user || !challenge || !generatedImageBase64 || !userPrompt || !targetImageBase64) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: user, challenge, generatedImageBase64, userPrompt, targetImageBase64'
      });
    }

    // Validate user object
    if (!user.email) {
      return res.status(400).json({
        error: true,
        message: 'User email is required'
      });
    }

    // Validate challenge object
    if (!challenge.name || !challenge.description) {
      return res.status(400).json({
        error: true,
        message: 'Challenge name and description are required'
      });
    }

    // Initialize AI if apiKey is provided
    if (apiKey) {
      initializeAi(apiKey);
    } else if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: true,
        message: 'API key is required for image analysis'
      });
    }

    const analysisResult = await analyzeImages(
      user,
      challenge,
      generatedImageBase64,
      userPrompt,
      targetImageBase64
    );

    res.json({
      success: true,
      analysis: analysisResult,
      user: user.email,
      challenge: challenge.name
    });

  } catch (error) {
    console.error('Error analyzing images:', error);
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : 'Failed to analyze images'
    });
  }
};
