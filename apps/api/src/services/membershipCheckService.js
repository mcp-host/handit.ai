import axios from 'axios';

const HANDIT_SASS_URL = process.env.HANDIT_SASS_URL;
const HANDIT_CLOUD_ENABLED = process.env.HANDIT_CLOUD_ENABLED === 'true';

/**
 * Checks if the user's action is allowed by their plan via Handit SASS.
 * @param {Object} params
 * @param {Object} params.user - The user object
 * @param {string} params.token - The user's token
 * @param {string} params.endpoint - The API endpoint being accessed
 * @param {string} params.method - The HTTP method (GET, POST, etc.)
 * @param {string} params.actionKey - A key representing the action
 * @returns {Promise<void>} Throws error if not allowed
 */
export const checkMembership = async ({ user, token, endpoint, method, actionKey }) => {
  console.log('🔍 Membership check:', { 
    HANDIT_CLOUD_ENABLED, 
    HANDIT_SASS_URL: HANDIT_SASS_URL ? 'SET' : 'NOT SET',
    endpoint,
    method 
  });
  
  if (!HANDIT_CLOUD_ENABLED) {
    console.log('✅ Membership check skipped - cloud disabled');
    return;
  }
  if (!HANDIT_SASS_URL) {
    console.error('❌ HANDIT_SASS_URL is not set');
    throw new Error('HANDIT_SASS_URL is not set');
  }

  try {
    const response = await axios.post(HANDIT_SASS_URL, {
      user,
      token,
      endpoint,
      method,
      actionKey,
    });
    
    console.log('📡 Membership check response:', response.data);
    
    if (!response.data.allowed) {
      throw new Error(response.data.message || 'Action not allowed by plan');
    }
    
    console.log('✅ Membership check passed');
  } catch (error) {
    console.error('❌ Membership check failed:', error.message);
    throw error;
  }
}