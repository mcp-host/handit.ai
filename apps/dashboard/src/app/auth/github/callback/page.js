/**
 * GitHub OAuth Callback Page
 * 
 * This page handles the GitHub OAuth callback and processes the authentication token.
 * It extracts the token from the URL, stores it in localStorage, and redirects the user
 * to the appropriate page based on their authentication state.
 * 
 * Features:
 * - Token extraction from URL parameters
 * - Authentication state management
 * - Automatic redirect to dashboard or setup
 * - Error handling and user feedback
 */

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { setCredentials } from '@/store/authSlice';
import { useUser } from '@/hooks/use-user';
import { authApi } from '@/services/auth/authService';
import { store } from '@/store';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';

/**
 * GitHub OAuth Callback Page Component
 * 
 * Handles the OAuth callback by:
 * 1. Extracting the token from URL parameters
 * 2. Storing the token in Redux store and localStorage
 * 3. Refreshing the user session
 * 4. Redirecting to the appropriate page
 * 
 * @returns {JSX.Element} The callback processing page
 */
export default function GitHubOAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const { checkSession } = useUser();
  
  const [status, setStatus] = React.useState('processing');
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract parameters from URL
        const token = searchParams.get('token');
        const setup = searchParams.get('setup');
        const installations = searchParams.get('installations');
        const error = searchParams.get('error');
        const message = searchParams.get('message');

        // Handle OAuth errors
        if (error) {
          console.error('GitHub OAuth error:', error, message);
          setError(`GitHub OAuth failed: ${message || error}`);
          setStatus('error');
          return;
        }

        // Check if token is present
        if (!token) {
          setError('No authentication token received');
          setStatus('error');
          return;
        }

        console.log('🔑 Processing GitHub OAuth token...');

        // Store the token in Redux store
        dispatch(setCredentials({ token }));

        // Store the token in localStorage for persistence
        localStorage.setItem('custom-auth-token', token);
        console.log('✅ Token stored in localStorage');

        // Wait a moment for Redux store to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify token is accessible
        const storedToken = localStorage.getItem('custom-auth-token');
        console.log('🔍 Stored token check:', storedToken ? 'EXISTS' : 'MISSING');

        // Fetch user data from API
        setStatus('authenticating');
        console.log('🔄 Fetching user data from API...');
        
        // Make direct API call to ensure token is used
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
        const response = await fetch(`${apiBaseUrl}/users/me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('❌ Direct API Error:', response.status, errorData);
          setError(`Failed to fetch user data: ${response.status} - ${errorData}`);
          setStatus('error');
          return;
        }

        const userData = await response.json();
        console.log('📡 Direct API response:', userData);
        if (!userData) {
          setError('No user data received');
          setStatus('error');
          return;
        }

        // Store user data in localStorage for authClient compatibility
        localStorage.setItem('user', JSON.stringify(userData));

        console.log('✅ GitHub OAuth authentication successful');

        // Determine redirect destination - use window.location for full reload
        setTimeout(() => {
          if (installations) {
            // Multiple installations - redirect to organization picker
            window.location.href = `/auth/github/select-org?installations=${encodeURIComponent(installations)}`;
          } else if (setup === 'github') {
            // No installations - redirect to dashboard with GitHub setup prompt
            window.location.href = '/?setup=github';
          } else {
            // Single installation or default - redirect to dashboard
            window.location.href = '/';
          }
        }, 1000);

      } catch (error) {
        console.error('Error processing GitHub OAuth callback:', error);
        setError('Authentication failed. Please try again.');
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, dispatch, checkSession, router]);

  // Show loading state
  if (status === 'processing' || status === 'authenticating') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
        }}
      >
        <CircularProgress size={40} />
      </Box>
    );
  }

  // Show error state
  if (status === 'error') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2,
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ maxWidth: 500 }}>
          {error}
        </Alert>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          You will be redirected to the sign-in page in a few seconds.
        </Typography>
      </Box>
    );
  }

  return null;
}
