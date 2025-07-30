/**
 * CLI Authentication Service
 * 
 * This service handles CLI authentication flow in the dashboard,
 * allowing users to generate CLI authentication codes.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithSandbox } from './baseQuery';

/**
 * CLI Authentication API instance
 * Provides endpoints for managing CLI authentication codes
 */
export const cliAuthApi = createApi({
  reducerPath: 'cliAuthApi',
  baseQuery: baseQueryWithSandbox,
  tagTypes: ['cliCodes'],
  endpoints: (builder) => ({
    /**
     * Generate a new CLI authentication code
     * @type {MutationEndpoint}
     */
    generateCode: builder.mutation({
      query: ({ userId, companyId }) => ({
        url: 'cli/auth/generate',
        method: 'POST',
        body: { userId, companyId },
      }),
      invalidatesTags: ['cliCodes'],
    }),

    /**
     * Check CLI authentication status
     * @type {MutationEndpoint}
     */
    checkStatus: builder.mutation({
      query: (code) => ({
        url: 'cli/auth/status',
        method: 'POST',
        body: { code },
      }),
    }),

    /**
     * Get pending CLI codes for the current user
     * @type {QueryEndpoint}
     */
    getPendingCodes: builder.query({
      query: () => 'cli/auth/pending',
      providesTags: ['cliCodes'],
    }),

    /**
     * Approve a CLI authentication code
     * @type {MutationEndpoint}
     */
    approveCode: builder.mutation({
      query: (code) => ({
        url: `cli/auth/approve/${code}`,
        method: 'POST',
      }),
      invalidatesTags: ['cliCodes'],
    }),
  }),
});

// Export generated hooks
export const {
  useGenerateCodeMutation,
  useCheckStatusMutation,
  useGetPendingCodesQuery,
  useApproveCodeMutation,
} = cliAuthApi; 