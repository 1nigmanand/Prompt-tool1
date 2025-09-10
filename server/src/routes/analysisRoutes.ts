import { Router } from 'express';
import { analyzeImageComparison } from '../controllers/analysisController';

const router = Router();

// POST /api/analysis/compare
// Analyze and compare generated image with target image
router.post('/compare', analyzeImageComparison);

export default router;
