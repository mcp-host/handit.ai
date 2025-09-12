/**
 * Authentication API Service
 * 
 * This service provides a set of endpoints for handling user authentication and management
 * using Redux Toolkit Query. It includes functionality for login, signup, user data management,
 * and password updates.
 * 
 * @module authService
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { setCredentials, setUserData } from '../../store/authSlice';
import { baseQueryWithSandbox } from '../baseQuery';
import { paths } from '@/paths';

/**
 * Authentication API instance created using Redux Toolkit Query
 * Provides endpoints for user authentication and management
 * 
 * @type {Object}
 */
export const authApi = createApi({
  // Unique identifier for this API slice in the Redux store
  reducerPath: 'authApi',
  // Base query configuration with sandbox mode support
  baseQuery: baseQueryWithSandbox,
  // Cache tags for managing data invalidation
  tagTypes: ['user', 'userMe'],
  endpoints: (builder) => ({
    /**
     * Login endpoint for user authentication
     * Handles user login and sets credentials in the store
     * 
     * @type {Object}
     */
    login: builder.mutation({
      // Configure the API request
      query: (credentials) => ({
        url: 'auth/login',
        method: 'POST',
        body: credentials,
      }),
      // Handle side effects after the query is started
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          // Wait for the query to complete and get the response
          const { data } = await queryFulfilled;
          // Store the authentication token
          dispatch(setCredentials({ token: data.token }));
          // If user data is included in the response, store it
          if (data.user) {
            dispatch(setUserData({ user: data.user }));
          }
        } catch (err) {
          console.error('Login failed:', err);
          return {
            error: 'Login failed',
            message: 'Invalid email or password',
          }
        }
      },
    }),

    /**
     * Signup endpoint for company registration
     * Handles new company registration and sets initial credentials
     * 
     * @type {Object}
     */
    signUp: builder.mutation({
      // Configure the API request for company signup
      query: (userData) => ({
        url: 'auth/signup-company',
        method: 'POST',
        body: userData,
      }),
      // Handle side effects after signup
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          // Store the authentication token after successful signup
          dispatch(setCredentials({ token: data.token }));
        } catch (err) {
          console.error('Login failed:', err);
          return {
            error: 'Login failed',
            message: 'Invalid email or password',
          }
        }
      },
      // Invalidate user cache when a new user is created
      invalidatesTags: ['user'],
    }),

    /**
     * Get current user data endpoint
     * Retrieves and stores the current user's information
     * 
     * @type {Object}
     */
    getUser: builder.query({
      // Endpoint to fetch current user data
      query: () => '/users/me',
      // Cache tag for this query
      providesTags: ['userMe'],
      // Handle side effects when fetching user data
      async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
        // Skip if user data is already in the store
        const currentUser = getState().auth.user;
        if (currentUser) {
          return;
        }

        try {
          const { data } = await queryFulfilled;
          // Store user data if available
          if (data) {
            dispatch(setUserData({ user: data }));
          }
        } catch (err) {
          console.error('Failed to get user:', err);
          window.location.href = paths.auth.custom.signIn;
          return {
            error: 'Failed to get user',
            message: 'Could not fetch user data',
          };
        }
      },
    }),

    /**
     * Add new user endpoint
     * Creates a new user in the system
     * 
     * @type {Object}
     */
    addUser: builder.mutation({
      // Configure the API request for adding a new user
      query: (userData) => ({
        url: `users`,
        method: 'POST',
        body: userData,
      }),
      // Invalidate user cache when a new user is added
      invalidatesTags: ['user'],
    }),

    /**
     * Update user endpoint
     * Updates an existing user's information
     * 
     * @type {Object}
     */
    updateUser: builder.mutation({
      // Configure the API request for updating user data
      query: (userData) => ({
        url: `users/${userData.id}`,
        method: 'PUT',
        body: userData,
      }),
      // Invalidate user cache when user data is updated
      invalidatesTags: ['user'],
    }),

    /**
     * Update password endpoint
     * Handles user password updates
     * 
     * @type {Object}
     */
    updatePassword: builder.mutation({
      // Configure the API request for password update
      query: (passwordsData) => ({
        url: `users/password`,
        method: 'PUT',
        body: passwordsData,
      }),
      // Invalidate user cache when password is updated
      invalidatesTags: ['user'],
    }),
  }),
});

/**
 * Exported hooks for using the authentication API endpoints
 * These hooks provide access to the mutation and query functions
 * along with loading and error states
 */
export const {
  useLoginMutation,
  useSignUpMutation,
  useGetUserQuery,
  useAddUserMutation,
  useUpdateUserMutation,
  useUpdatePasswordMutation,
} = authApi;
