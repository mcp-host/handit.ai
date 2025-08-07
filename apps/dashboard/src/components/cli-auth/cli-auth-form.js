/**
 * CLI Authentication Form Component
 * 
 * This component provides a form for generating CLI authentication codes
 * without requiring prior authentication. Users can enter their user ID and
 * company ID to generate codes for CLI authentication.
 * 
 * Features:
 * - Public access (no authentication required)
 * - Form validation
 * - Code generation
 * - Success/error feedback
 * - Responsive design
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Link,
} from '@mui/material';
import { Key, Computer, CheckCircle, Error } from '@mui/icons-material';
import { useGenerateCodeMutation } from '../../services/cliAuthService';
import { useUser } from '@/hooks/use-user';
import { authClient } from '@/lib/auth/custom/client';

/**
 * CLI Authentication Form Component
 * 
 * @returns {JSX.Element} The CLI authentication form component
 */
export function CLIAuthForm() {
  const router = useRouter();
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
  });
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(null);
  const { checkSession } = useUser();

  // RTK Query hooks
  const [generateCode, { isLoading: isGenerating }] = useGenerateCodeMutation();

  /**
   * Handle form input changes
   */
  const handleInputChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    // Clear errors when user starts typing
    if (error) setError('');
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');

    try {
      // First authenticate the user
      const { error } = await authClient.signInWithPassword(formData);
      if (error) {
        setError('root', { type: 'server', message: 'Invalid Credentials' });
        return;
      }

      let data = await checkSession?.();
      await setTimeout(async () => {
        data = await checkSession?.();
      }, 1000);

      if (!data) {
        setError('root', { type: 'server', message: 'Invalid Credentials' });
        return;
      }
      console.log(data);


      // Generate CLI code using RTK Query
      const cliResult = await generateCode({
        userId: data.id,
        companyId: data.companyId,
      }).unwrap();

      setSuccess({
        code: cliResult.code,
        expiresAt: cliResult.expiresAt,
        user: data,
      });

      // Clear form
      setFormData({ email: '', password: '' });
    } catch (err) {
      setError(err.message || 'Invalid Credentials');
    }
  };

  /**
   * Format expiration time
   */
  const formatExpiration = (expiresAt) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires - now;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins <= 0) {
      return 'Expired';
    }
    
    return `${diffMins} minutes remaining`;
  };

  /**
   * Copy code to clipboard
   */
  const copyToClipboard = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  return (
    <Box
      component="main"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 3,
      }}
    >
      <Box
        sx={{
          maxWidth: 400,
          width: '100%',
          mx: 'auto',
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <Computer
              sx={{
                fontSize: 48,
                color: 'primary.main',
              }}
            />
          </Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{ mb: 1 }}
          >
            CLI Authentication
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
          >
            Generate authentication codes for the handit CLI tool
          </Typography>
        </Box>

        {/* Success Message */}
        {success && (
          <Card sx={{ mb: 3, border: '1px solid', borderColor: 'success.main' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <CheckCircle color="success" sx={{ mr: 1 }} />
                <Typography variant="h6" color="success.main">
                  Code Generated Successfully!
                </Typography>
              </Box>
              
              <Typography variant="body2" sx={{ mb: 2 }}>
                Use this code in your CLI to complete authentication:
              </Typography>
              
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'grey.300',
                  mb: 2,
                }}
              >
                <Typography
                  variant="h5"
                  component="code"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    color: '#05171c',
                  }}
                >
                  {success.code}
                </Typography>
              </Box>
              
              <Box display="flex" gap={1} mb={2}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => copyToClipboard(success.code)}
                >
                  Copy Code
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setSuccess(null)}
                >
                  Generate Another
                </Button>
              </Box>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Expires:</strong> {formatExpiration(success.expiresAt)}
                </Typography>
              </Alert>
              
              <Typography variant="body2" color="text.secondary">
                Run your CLI command now to complete the authentication process.
                The authentication will complete automatically once you use the code.
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Main Form */}
        {!success && <Card>
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="h6"
              component="h2"
              sx={{ mb: 3 }}
            >
              Generate Authentication Code
            </Typography>

            {/* Error Alert */}
            {error && (
              <Alert
                severity="error"
                sx={{ mb: 3 }}
                onClose={() => setError('')}
              >
                {'Invalid Credentials'}
              </Alert>
            )}

            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
            >
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleInputChange('email')}
                placeholder="Enter your email"
                required
                fullWidth
                disabled={isGenerating}
              />

              <TextField
                label="Password"
                type="password"
                value={formData.password}
                onChange={handleInputChange('password')}
                placeholder="Enter your password"
                required
                fullWidth
                disabled={isGenerating}
              />

              <Button
                type="submit"
                variant="outlined"
                size="large"
                disabled={isGenerating || !formData.email || !formData.password}
                sx={{ mt: 2 }}
              >
                {isGenerating ? (
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                ) : (
                  <Key sx={{ mr: 1 }} />
                )}
                Generate CLI Code
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Help Section */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>How it works:</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                1. Sign in with your email and password
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                2. Generate an authentication code
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                3. Use the code in your CLI command
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                4. Authentication completes automatically
              </Typography>
            </Box>
          </CardContent>
        </Card>}
      </Box>
    </Box>
  );
} 