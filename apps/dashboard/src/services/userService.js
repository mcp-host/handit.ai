/**
 * User Service
 * Handles user-related API calls
 */

/**
 * Makes authenticated API calls
 * @param {string} url - API endpoint
 * @param {Object} options - Request options
 * @returns {Promise<Object>} API response
 */
async function makeApiCall(url, options = {}) {
  const token = localStorage.getItem('custom-auth-token');
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${baseUrl}${url}`, config);
    
    // sign out
    if (response.status === 401) {
      localStorage.removeItem('custom-auth-token');
      window.location.href = '/auth/custom/sign-in';
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

/**
 * User Service class
 */
class UserService {
  /**
   * Update user's onboarding progress
   * @param {string} onboardingCurrentTour - The current tour ID
   * @returns {Promise<Object>} API response
   */
  async updateOnboardingProgress(onboardingCurrentTour) {
    
    // Validate the parameter
    if (onboardingCurrentTour === undefined) {
      return Promise.resolve({ message: 'Skipped - undefined tourId' });
    }
    
    try {
      const response = await makeApiCall('/users/me/onboarding', {
        method: 'PUT',
        body: {
          onboardingCurrentTour
        }
      });

      let user = localStorage.getItem('user');
      user = JSON.parse(user);
      if (onboardingCurrentTour === 'autonomous-engineer-setup' && user.onboardingCurrentTour && user.onboardingCurrentTour !== 'welcome-concept-walkthrough') {
        return { message: 'You must complete the welcome concept walkthrough first' };
      }
      user.onboardingCurrentTour = onboardingCurrentTour;
      localStorage.setItem('user', JSON.stringify(user));

      // Trigger user data refresh after successful update
      this.triggerUserDataRefresh();
      
      return response;
    } catch (error) {
      console.error('Error updating onboarding progress:', error);
      throw error;
    }
  }

  /**
   * Trigger user data refresh by dispatching a custom event
   * This will cause the user context to refetch user data
   */
  triggerUserDataRefresh() {
    if (typeof window !== 'undefined') {
      // Dispatch a custom event that the user context can listen to
      window.dispatchEvent(new CustomEvent('userDataChanged', {
        detail: { reason: 'onboarding-progress-updated' }
      }));
    }
  }

  /**
   * Get current user data
   * @returns {Promise<Object>} User data
   */
  async getMe() {
    try {
      const response = await makeApiCall('/users/me', {
        method: 'GET'
      });
      return response;
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {Object} userData - User data to update
   * @returns {Promise<Object>} Updated user data
   */
  async updateProfile(userData) {
    try {
      const response = await makeApiCall('/users/me', {
        method: 'PUT',
        body: userData
      });
      
      // Trigger user data refresh after successful update
      this.triggerUserDataRefresh();
      
      return response;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Check if user has optimizations
   * @returns {Promise<Object>} Optimization status data
   */
  async checkOptimizations() {
    try {
      const response = await makeApiCall('/users/me/optimizations', {
        method: 'GET'
      });
      return response;
    } catch (error) {
      console.error('Error checking user optimizations:', error);
      throw error;
    }
  }
}

export default new UserService(); 