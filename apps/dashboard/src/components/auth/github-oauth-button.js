/**
 * GitHub OAuth Button Component
 * 
 * A reusable button component that initiates GitHub OAuth authentication.
 * This button works for both sign-in and sign-up flows, automatically
 * handling user discovery and account creation/linking.
 * 
 * Features:
 * - Single button for both login and signup flows
 * - Loading state during OAuth process
 * - Error handling and user feedback
 * - Integration with GitHub OAuth backend
 * - Responsive design with Material-UI
 * 
 * @module GitHubOAuthButton
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { GithubLogo } from '@phosphor-icons/react/dist/ssr/GithubLogo';

/**
 * GitHub OAuth Button Component
 * 
 * Renders a button that initiates GitHub OAuth flow for authentication.
 * The button handles both new user registration and existing user login
 * through the GitHub OAuth process.
 * 
 * @param {Object} props - Component props
 * @param {string} props.redirectUri - Optional redirect URI after OAuth
 * @param {boolean} props.fullWidth - Whether button should take full width
 * @param {string} props.size - Button size ('small', 'medium', 'large')
 * @param {boolean} props.showDivider - Whether to show divider above button
 * @returns {JSX.Element} The GitHub OAuth button component
 * 
 * @example
 * // Basic usage
 * <GitHubOAuthButton />
 * 
 * @example
 * // With custom redirect
 * <GitHubOAuthButton redirectUri="/dashboard" />
 * 
 * @example
 * // Full width with divider
 * <GitHubOAuthButton fullWidth showDivider />
 */
export function GitHubOAuthButton({ 
  redirectUri = '', 
  fullWidth = false, 
  size = 'medium',
  showDivider = false 
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  /**
   * Handles GitHub OAuth initiation
   * Redirects user to GitHub OAuth authorization page
   */
  const handleGitHubOAuth = React.useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Build the OAuth URL with redirect URI
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
      const oauthUrl = new URL('/api/auth/github/auth', apiBaseUrl);
      if (redirectUri) {
        oauthUrl.searchParams.set('redirect_uri', redirectUri);
      }

      // Redirect to GitHub OAuth
      window.location.href = oauthUrl.toString();
    } catch (error) {
      console.error('Error initiating GitHub OAuth:', error);
      setIsLoading(false);
    }
  }, [redirectUri]);

  return (
    <Stack spacing={2} sx={{ width: fullWidth ? '100%' : 'auto' }}>
      {showDivider && (
        <Box sx={{ display: 'flex', alignItems: 'center', my: 0.1 }}>
          <Box sx={{ flex: 1, height: 1, backgroundColor: 'divider' }} />
          <Typography variant="body2" sx={{ px: 2, color: 'text.secondary' }}>
            - or sign in with -
          </Typography>
          <Box sx={{ flex: 1, height: 1, backgroundColor: 'divider' }} />
        </Box>
      )}
      
      <Button
        variant="outlined"
        size={size}
        fullWidth={fullWidth}
        disabled={isLoading}
        onClick={handleGitHubOAuth}
        startIcon={
          isLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <GithubLogo fontSize="var(--icon-fontSize-md)" />
          )
        }
        sx={{
          borderColor: 'grey.300',
          color: 'text.primary',
          backgroundColor: 'background.paper',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: '#1f4d53',
          },
          '&:disabled': {
            borderColor: 'grey.200',
            color: 'text.disabled',
          },
        }}
      >
        {isLoading ? 'Connecting...' : 'Continue with GitHub'}
      </Button>
    </Stack>
  );
}
