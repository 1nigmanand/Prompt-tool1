/**
 * API Configuration
 * Automatically switches between local and production URLs based on environment
 */

// Check if we're in development or production
const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';

// API Base URLs
const LOCAL_API_URL = 'http://localhost:8787';
const PRODUCTION_API_URL = 'https://workers-api.prompt-tool1-api.workers.dev';

// Export the appropriate URL based on environment
export const API_BASE_URL = isDevelopment ? LOCAL_API_URL : PRODUCTION_API_URL;

// For backward compatibility, export specific URLs
export const API_ENDPOINTS = {
  // Core API base (without /api suffix)
  BASE: API_BASE_URL,
  
  // API routes (with /api suffix)
  API: `${API_BASE_URL}/api`,
  
  // Specific endpoints
  HEALTH: `${API_BASE_URL}/health`,
  IMAGES: `${API_BASE_URL}/api/images`,
  ANALYSIS: `${API_BASE_URL}/api/analysis`,
  USERS: `${API_BASE_URL}/api/users`,
  STATUS: `${API_BASE_URL}/api/status`
};

// Debug info
console.log('🔧 API Configuration:', {
  isDevelopment,
  hostname: window.location.hostname,
  apiBaseUrl: API_BASE_URL,
  environment: isDevelopment ? 'Development' : 'Production'
});
