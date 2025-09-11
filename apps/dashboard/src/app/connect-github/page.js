'use client';

import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Stack, Alert, AlertTitle, Divider } from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import LaunchIcon from '@mui/icons-material/Launch';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { SplitLayout } from '@/components/auth/split-layout';

export default function ConnectGitHubPage() {
  const [email, setEmail] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleConnectGitHub = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Redirect to API endpoint that handles GitHub App installation
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://handit-api-oss-299768392189.us-central1.run.app';
      const redirectUrl = `${apiBase}/api/git/redirect-by-email?email=${encodeURIComponent(email)}`;
      window.location.href = redirectUrl;
    } catch (err) {
      setError('Failed to connect to GitHub. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (error) setError(null); // Clear error when user starts typing
  };

  return (
    <SplitLayout>
      <Paper elevation={8} sx={{ p: 4, borderRadius: 3, maxWidth: 600 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
            Connect Your GitHub Repository
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
            Let handit.ai analyze your AI code and automatically create improvements
          </Typography>
        </Box>

        {/* What is handit.ai */}
        <Alert severity="info" sx={{ mb: 4 }}>
          <AlertTitle>🤖 What is handit.ai?</AlertTitle>
          <Typography variant="body2" sx={{ mb: 2 }}>
            handit.ai is your autonomous engineer that monitors your AI 24/7. We detect issues, 
            generate fixes, test them against real data, and ship them as pull requests—all automatically.
          </Typography>
          <Typography variant="body2">
            <strong>No more 2am AI failures.</strong> We catch problems before your customers do.
          </Typography>
        </Alert>

        {/* Why GitHub */}
        

        <Divider sx={{ my: 3 }} />

        {/* Email Input */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Get Started
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
            Enter your email address to connect your GitHub account and start improving your AI
          </Typography>
          
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="your.email@company.com"
            error={!!error}
            helperText={error}
            disabled={isConnecting}
            sx={{ mb: 3 }}
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<GitHubIcon />}
            onClick={handleConnectGitHub}
            disabled={isConnecting || !email.trim()}
            sx={{ 
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              background: 'linear-gradient(45deg, #24292e 30%, #586069 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1a1e22 30%, #4a5568 90%)',
              }
            }}
          >
            {isConnecting ? 'Connecting to GitHub...' : 'Connect GitHub Repository'}
          </Button>
        </Box>

        {/* Security Note */}
        

        {/* What happens next */}
        <Box sx={{ mt: 4, p: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            What happens next?
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2">
              1. <strong>Install GitHub App:</strong> Grant handit.ai access to your repositories
            </Typography>
            <Typography variant="body2">
              2. <strong>Select Repository:</strong> Choose which AI project to analyze
            </Typography>
            <Typography variant="body2">
              3. <strong>Automatic Analysis:</strong> We'll scan your code and create an assessment report
            </Typography>
            <Typography variant="body2">
              4. <strong>Continuous Monitoring:</strong> Your AI will be monitored 24/7 for improvements
            </Typography>
          </Stack>
        </Box>

        {/* Footer */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Need help? <Button variant="text" size="small" href="mailto:support@handit.ai">Contact Support</Button>
          </Typography>
        </Box>
      </Paper>
    </SplitLayout>
  );
}
