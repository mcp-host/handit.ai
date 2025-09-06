/**
 * Authentication State Management
 * 
 * This module implements the Redux slice for managing authentication state.
 * It handles user authentication status, tokens, and user data persistence
 * across page reloads using localStorage.
 * 
 * @module authSlice
 */

import { createSlice } from '@reduxjs/toolkit';

/**
 * Initial state for the authentication slice
 * @type {Object}
 */
const initialState = {
  token: null,
  isAuthenticated: false,
  user: null,
};

/**
 * Loads the initial state from localStorage if available
 * This ensures authentication state persists across page reloads
 * 
 * @returns {Object} The initial state with persisted values if available
 */
const loadInitialState = () => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined') {
    // Retrieve stored token and user data
    const token = localStorage.getItem('custom-auth-token');
    const savedUser = localStorage.getItem('user');

    return {
      token: token || null,
      isAuthenticated: !!token,
      user: savedUser ? JSON.parse(savedUser) : null,
    };
  }
  return initialState;
};

/**
 * Redux slice for authentication state management
 * Provides actions for managing authentication state and user data
 */
const authSlice = createSlice({
  name: 'auth',
  initialState: loadInitialState(),
  reducers: {
    /**
     * Sets authentication credentials in state and localStorage
     * @param {Object} state - Current state
     * @param {Object} payload - Action payload containing token
     */
    setCredentials: (state, { payload }) => {
      // Update state with new token
      state.token = payload.token;
      state.isAuthenticated = true;

      // Persist token to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('custom-auth-token', payload.token);
      }
    },

    /**
     * Sets sandbox credentials for testing/development
     * Creates a test user with predefined data
     * @param {Object} state - Current state
     */
    setSandboxCredentials: (state) => {
      // Set sandbox token and authentication state
      state.token = 'sandbox-test-token';
      state.isAuthenticated = true;

      // Store sandbox credentials in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('custom-auth-token', 'sandbox-test-token');
        // Store test user data
        localStorage.setItem(
          'user',
          JSON.stringify({
            id: 1,
            firstName: 'Sandbox',
            lastName: 'User',
            phoneNumber: null,
            title: null,
            email: 'sandbox@user.com',
            role: 'user',
            ssoLogin: null,
            companyId: 13,
            deletedAt: null,
            membershipId: 1,
            createdAt: '2024-11-05T19:04:34.688Z',
            updatedAt: '2024-11-05T19:04:34.688Z',
            company_id: 13,
            company: {
              id: 13,
              name: 'test test',
              location: null,
              icon: null,
              url: null,
              nationalId: 'test@gmail.com',
              apiToken: 'test',
              deletedAt: null,
              createdAt: '2024-11-05T19:04:34.521Z',
              updatedAt: '2024-11-05T19:04:34.521Z',
            },
          })
        );
      }
    },

    /**
     * Updates user data in state and localStorage
     * @param {Object} state - Current state
     * @param {Object} payload - Action payload containing user data
     */
    setUserData: (state, { payload }) => {
      // Update state with new user data
      state.user = payload.user;
      // Persist user data to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(payload.user));
      }
    },

    /**
     * Handles user logout
     * Clears authentication state and stored data
     * @param {Object} state - Current state
     */
    logout: (state) => {
      // Clear authentication state
      state.token = null;
      state.isAuthenticated = false;

      // Clear stored data from localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('custom-auth-token');
        localStorage.removeItem('user');
        localStorage.removeItem('onboardingState');

        // Clear all session data
        sessionStorage.clear(); // Clear sessionStorage
        // Note: We don't clear all localStorage to preserve user preferences like 'environment'
      }
    },
  },
});

// Export actions and reducer
export const { setCredentials, setUserData, logout, setSandboxCredentials } = authSlice.actions;
export default authSlice.reducer;
