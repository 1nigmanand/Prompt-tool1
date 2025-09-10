import { Request, Response } from 'express';
import { getGeminiKeyManager } from '../services/geminiKeyManager.js';

/**
 * 📊 Get Gemini API Key Manager Status
 * GET /api/status/keys
 */
export const getKeyManagerStatus = async (req: Request, res: Response) => {
  try {
    console.log('📊 Key Manager Status Request');
    
    const status = getGeminiKeyManager().getStatus();
    
    // Return comprehensive status information
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      keyManager: {
        totalKeys: status.totalKeys,
        availableKeys: status.availableKeys,
        blockedKeys: status.blockedKeys,
        keyStats: status.keyStats.map(stat => ({
          key: stat.key.substring(0, 8) + '...', // Hide most of the key for security
          usageCount: stat.usageCount,
          lastUsed: stat.lastUsed,
          isBlocked: stat.isBlocked,
          errorCount: stat.errorCount
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting key manager status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get key manager status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * 🔄 Reset Gemini API Key Manager Metrics (Not implemented)
 * POST /api/status/keys/reset
 */
export const resetKeyManagerMetrics = async (req: Request, res: Response) => {
  try {
    console.log('🔄 Key Manager Metrics Reset Request');
    
    // Note: Reset functionality not implemented in current GeminiKeyManager
    // This would require adding a resetMetrics method to the GeminiKeyManager class
    
    res.json({
      success: true,
      message: 'Reset functionality not implemented yet - metrics will auto-cleanup over time',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error resetting key manager metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset key manager metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
