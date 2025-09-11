/**
 * Status Routes for Workers API
 */

import { Hono } from 'hono';
import { getKeyManagerStatus, resetKeyManagerMetrics } from '../controllers/statusController';

const statusRoutes = new Hono();

/**
 * Status Routes
 * 
 * GET /api/status/keys - Get Gemini Key Manager status
 * POST /api/status/keys/reset - Reset key manager metrics
 */

// Get key manager status
statusRoutes.get('/keys', getKeyManagerStatus);

// Reset key manager metrics  
statusRoutes.post('/keys/reset', resetKeyManagerMetrics);

export default statusRoutes;
