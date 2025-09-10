import { Router } from 'express';
import { getKeyManagerStatus, resetKeyManagerMetrics } from '../controllers/statusController';

const router = Router();

/**
 * Status Routes
 * 
 * GET /api/status/keys - Get Gemini Key Manager status
 * POST /api/status/keys/reset - Reset key manager metrics
 */

// Get key manager status
router.get('/keys', getKeyManagerStatus);

// Reset key manager metrics  
router.post('/keys/reset', resetKeyManagerMetrics);

export default router;
