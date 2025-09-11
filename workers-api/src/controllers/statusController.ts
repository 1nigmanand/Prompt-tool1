/**
 * 📊 Status Controller for Workers
 * Handles system status and key manager monitoring
 * Based on server implementation
 */

import { getGeminiKeyManager } from '../geminiKeyManager';

/**
 * Get Gemini API Key Manager Status
 * GET /api/status/keys
 */
export async function getKeyManagerStatus(c: any) {
  try {
    console.log('📊 Key Manager Status Request');
    
    const keyManager = getGeminiKeyManager(c.env);
    const status = keyManager.getStatus();
    
    // Return comprehensive status information
    return c.json({
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
    return c.json({
      success: false,
      error: 'Failed to get key manager status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * Reset Gemini API Key Manager Metrics
 * POST /api/status/keys/reset
 */
export async function resetKeyManagerMetrics(c: any) {
  try {
    console.log('🔄 Key Manager Metrics Reset Request');
    
    // Note: Reset functionality would need to be implemented in GeminiKeyManager
    // This would require adding a resetMetrics method to the GeminiKeyManager class
    
    return c.json({
      success: true,
      message: 'Reset functionality not implemented yet - metrics will auto-cleanup over time',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error resetting key manager metrics:', error);
    return c.json({
      success: false,
      error: 'Failed to reset key manager metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
}

/**
 * Health check endpoint
 * GET /health
 */
export async function healthCheck(c: any) {
  return c.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Prompt Tool Workers API',
    version: '1.0.0'
  });
}
