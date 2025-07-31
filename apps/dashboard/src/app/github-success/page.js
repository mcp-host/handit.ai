'use client';
/**
 * @fileoverview GitHub Success Page
 * 
 * This page displays the result of GitHub OAuth integration.
 * It shows success or error messages when users complete the GitHub connection flow.
 * 
 * Features:
 * - Public access (no authentication required)
 * - Success/error state handling
 * - Beautiful gradient design
 * - Close tab functionality
 * 
 * @example
 * // The page will be accessible at:
 * // /github-success?success=true&integration_id=123
 * // /github-success?error=auth_failed
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Typography, Paper, Alert, AlertTitle } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { config } from '@/config';

/**
 * Page metadata for SEO and browser tab title
 * 
 * @type {Object}
 * @property {string} title - The page title in format "GitHub Integration | {siteName}"
 */

/**
 * GitHub Success Page Component
 * 
 * Renders the GitHub integration result page with the following structure:
 * - Success state: Green checkmark, congratulations message, next steps
 * - Error state: Error message, troubleshooting tips
 * - Close functionality: "Close this tab" link
 * 
 * @returns {JSX.Element} The GitHub success page component
 */
export default function GitHubSuccessPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const integrationId = searchParams.get('integration_id');

    if (success === 'true') {
      setStatus('success');
      setMessage('Congratulations! Your GitHub integration has been successfully connected.');
    } else if (error) {
      setStatus('error');
      setMessage('There was an error connecting your GitHub account. Please try again.');
    } else {
      setStatus('error');
      setMessage('Invalid callback parameters. Please try again.');
    }
  }, [searchParams]);

  const handleClose = () => {
    window.close();
  };

  if (status === 'loading') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b2026',
          padding: 2,
        }}
      >
        <Paper
          elevation={24}
          sx={{
            padding: 4,
            textAlign: 'center',
            maxWidth: 500,
            width: '100%',
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Typography variant="h6" color="#05171c">
            Processing...
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b2026',
        padding: 2,
      }}
    >
      <Paper
        elevation={24}
        sx={{
          padding: 4,
          textAlign: 'center',
          maxWidth: 500,
          width: '100%',
          borderRadius: 3,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {status === 'success' ? (
          <>
            <CheckCircleIcon 
              sx={{ 
                fontSize: 64, 
                color: '#05171c', 
                mb: 2 
              }} 
            />
            <Typography variant="h4" component="h1" gutterBottom color="#05171c" fontWeight="bold">
              🎉 Successfully Connected!
            </Typography>
            <Typography variant="body1" color="#05171c" paragraph>
              {message}
            </Typography>
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>Next Steps</AlertTitle>
              You can now configure your repository settings in the dashboard to enable automatic prompt optimizations.
            </Alert>
            <Typography variant="body2" color="#05171c" sx={{ mb: 2 }}>
              You can safely close this tab and return to your dashboard.
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="h4" component="h1" gutterBottom color="error.main" fontWeight="bold">
              ❌ Connection Failed
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {message}
            </Typography>
            <Alert severity="error" sx={{ mb: 3 }}>
              <AlertTitle>What went wrong?</AlertTitle>
              There was an issue connecting your GitHub account. This could be due to:
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Invalid or expired authorization</li>
                <li>Network connectivity issues</li>
                <li>GitHub service temporarily unavailable</li>
              </ul>
            </Alert>
          </>
        )}
        
        <Box sx={{ mt: 3 }}>
          <Typography 
            variant="body2" 
            color="#05171c" 
            sx={{ 
              cursor: 'pointer', 
              textDecoration: 'underline',
              '&:hover': { opacity: 0.8 }
            }}
            onClick={handleClose}
          >
            Close this tab
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
} 