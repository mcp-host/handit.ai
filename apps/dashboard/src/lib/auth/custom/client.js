'use client';

import { authApi } from '@/services/auth/authService';
import { kpiApi } from '@/services/kpiService';
import { modelsApi } from '@/services/modelsService';
import { alertsApi } from '@/services/alertsService';
import { monitoringApi } from '@/services/monitoringService';
import { modelsMetricsApi } from '@/services/modelMetricsService';
import { datasetsApi } from '@/services/datasetsService';
import { dashboardApi } from '@/services/dashboardService';
import { insightsApi } from '@/services/insightsService';
import { agentsApi } from '@/services/agentsService';
import { setupApi } from '@/services/setupService';
import { demoEmailApi } from '@/services/demoEmailService';
import { conversationApi } from '@/services/conversationService';
import { promptApi } from '@/services/promptService';
import { reviewersTemplateApi } from '@/services/reviewersTemplateService';
import { integrationTokenApi } from '@/services/integrationTokenService';
import { evaluatorMetricApi } from '@/services/evaluatorMetricService';
import { providerApi } from '@/services/providerService';
import { store } from '@/store';

/**
 * Generates a random token using the Web Crypto API
 * @returns {string} A random hexadecimal token
 */
function generateToken() {
  // Create a new Uint8Array with 12 bytes for random values
  const arr = new Uint8Array(12);
  // Fill the array with cryptographically secure random values
  window.crypto.getRandomValues(arr);
  // Convert each byte to a hexadecimal string and join them
  return Array.from(arr, (v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Default user object for development/testing purposes
 * @type {Object}
 */
const user = {
  id: 'USR-000',
  avatar: '/assets/avatar.png',
  firstName: 'Sofia',
  lastName: 'Rivers',
  email: 'sofia@devias.io',
};

/**
 * Authentication client for handling custom authentication operations
 * This class provides methods for user authentication, session management,
 * and user data retrieval using a custom authentication strategy.
 */
class AuthClient {
  /**
   * Registers a new user
   * @param {Object} params - User registration parameters
   * @returns {Promise<Object>} Empty object on success, error object on failure
   */
  async signUp(_) {
    try {
      // Make API request to register the user
      const signUpResult = await store.dispatch(authApi.endpoints.signUp.initiate(_));
      
      // Check if the signup was successful
      if (signUpResult.error) {
        // Extract error message from the API response
        const errorMessage = signUpResult.error?.data?.error || 'Signup failed';
        return { error: errorMessage };
      }
      
      // Fetch user data after successful registration
      await store.dispatch(authApi.endpoints.getUser.initiate());
      return {};
    } catch (error) {
      console.error('Signup error:', error);
      return { error: error.message || 'Signup failed' };
    }
  }

  /**
   * Handles OAuth-based authentication
   * @param {Object} params - OAuth parameters
   * @returns {Promise<{error: string}>} Error object indicating OAuth is not implemented
   */
  async signInWithOAuth(_) {
    return { error: 'Social authentication not implemented' };
  }

  /**
   * Authenticates a user with email and password
   * @param {Object} params - Authentication parameters
   * @param {string} params.email - User's email address
   * @param {string} params.password - User's password
   * @returns {Promise<Object>} Empty object on success, error object on failure
   */
  async signInWithPassword(params) {
    const { email, password } = params;
    // Make API request to authenticate user
    try {
      // Attempt to login with provided credentials
      const answerLogin = await store.dispatch(authApi.endpoints.login.initiate({ email, password }));
      if (answerLogin.error) {
        return answerLogin;
      }
      // Fetch user data after successful login
      await store.dispatch(authApi.endpoints.getUser.initiate());
      return {};
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Initiates password reset process
   * @param {Object} params - Password reset parameters
   * @returns {Promise<{error: string}>} Error object indicating reset is not implemented
   */
  async resetPassword(_) {
    return { error: 'Password reset not implemented' };
  }

  /**
   * Updates user's password
   * @param {Object} params - Password update parameters
   * @returns {Promise<{error: string}>} Error object indicating update is not implemented
   */
  async updatePassword(_) {
    return { error: 'Update reset not implemented' };
  }

  /**
   * Retrieves the current user's data from local storage
   * @returns {Promise<{data: Object|null}>} User data object or null if not authenticated
   */
  async getUser() {
    // Check for authentication token
    const token = localStorage.getItem('custom-auth-token');
    let user = localStorage.getItem('user');
    // Return null if no token is found
    if (!token) {
      return { data: null };
    }

    // Return null if no user data is found
    if (!user) {
      return { data: null };
    }
    // Parse and return the user data
    user = JSON.parse(user);
    return { data: user };
  }

  /**
   * Signs out the current user
   * Clears authentication token and resets application state
   * @returns {Promise<Object>} Empty object on success
   */
  async signOut() {
    // Remove authentication token and user data from local storage
    localStorage.removeItem('custom-auth-token');
    localStorage.removeItem('onboardingState');
    localStorage.removeItem('user');
    
    // Clear session storage completely
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }

    // Clear onboarding service state
    try {
      const { onboardingService } = await import('@/services/onboarding/onboardingService');
      onboardingService.clearOnboardingState();
      onboardingService.reset();
    } catch (error) {
      console.warn('Could not clear onboarding service:', error);
    }

    // Clear global onboarding flags
    if (typeof window !== 'undefined') {
      window.__onboardingActive = false;
      window.lastOnboardingEventDetail = null;
    }

    // Dispatch logout action to clear auth state
    store.dispatch({ type: 'auth/logout' });

    // Reset API state to clear any cached data
    await store.dispatch(authApi.util.resetApiState());
    await store.dispatch(kpiApi.util.resetApiState());
    await store.dispatch(modelsApi.util.resetApiState());
    await store.dispatch(alertsApi.util.resetApiState());
    await store.dispatch(monitoringApi.util.resetApiState());
    await store.dispatch(modelsMetricsApi.util.resetApiState());
    await store.dispatch(datasetsApi.util.resetApiState());
    await store.dispatch(dashboardApi.util.resetApiState());
    await store.dispatch(insightsApi.util.resetApiState());
    await store.dispatch(agentsApi.util.resetApiState());
    await store.dispatch(setupApi.util.resetApiState());
    await store.dispatch(demoEmailApi.util.resetApiState());
    await store.dispatch(conversationApi.util.resetApiState());
    await store.dispatch(promptApi.util.resetApiState());
    await store.dispatch(reviewersTemplateApi.util.resetApiState());
    await store.dispatch(integrationTokenApi.util.resetApiState());
    await store.dispatch(evaluatorMetricApi.util.resetApiState());
    await store.dispatch(providerApi.util.resetApiState());
    
    return {};
  }
}

export const authClient = new AuthClient();
