import { Request, Response } from 'express';
import { generateImageWithPollinations, generateImageWithGemini, initializeAi } from '../services/imageService';

export const generateImage = async (req: Request, res: Response) => {
  try {
    const { prompt, service = 'pollinations-flux', apiKey } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: true,
        message: 'Prompt is required'
      });
    }

    // Initialize AI if apiKey is provided and service requires Gemini
    if (service.startsWith('gemini-')) {
      if (apiKey) {
        initializeAi(apiKey);
      } else if (process.env.GEMINI_API_KEY) {
        initializeAi(process.env.GEMINI_API_KEY);
      } else {
        return res.status(400).json({
          error: true,
          message: 'API key is required for Gemini image generation. Please set GEMINI_API_KEY in server environment.'
        });
      }
    }

    let imageBase64: string;

    if (service.startsWith('pollinations-')) {
      const model = service.substring('pollinations-'.length);
      imageBase64 = await generateImageWithPollinations(prompt, model);
    } else if (service.startsWith('gemini-')) {
      imageBase64 = await generateImageWithGemini(prompt, service);
    } else {
      return res.status(400).json({
        error: true,
        message: 'Unknown image service selected'
      });
    }

    res.json({
      success: true,
      imageBase64,
      prompt,
      service
    });

  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : 'Failed to generate image'
    });
  }
};

export const getLocalImage = async (req: Request, res: Response) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        error: true,
        message: 'Image URL is required'
      });
    }

    // For local images, we'll read them from the client's public folder
    // In a real scenario, you'd serve these statically or from a CDN
    const fullImageUrl = imageUrl.startsWith('/') 
      ? `http://localhost:5173${imageUrl}` 
      : `http://localhost:5173/${imageUrl}`;
    
    const response = await fetch(fullImageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    res.json({
      success: true,
      imageBase64: base64,
      imageUrl
    });

  } catch (error) {
    console.error('Error fetching local image:', error);
    res.status(500).json({
      error: true,
      message: error instanceof Error ? error.message : 'Failed to fetch image'
    });
  }
};
