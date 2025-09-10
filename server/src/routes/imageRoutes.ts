import { Router } from 'express';
import { generateImage, getLocalImage } from '../controllers/imageController';

const router = Router();

// POST /api/images/generate
// Generate an image using either Pollinations or Gemini
router.post('/generate', generateImage);

// POST /api/images/local
// Get a local image as base64
router.post('/local', getLocalImage);

export default router;
