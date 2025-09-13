/**
 * Sign Up Form Component
 * 
 * This component provides a form for new user registration with:
 * - Multi-field validation using Zod schema
 * - Form state management with React Hook Form
 * - Error handling and display
 * - Loading state management
 * - Integration with custom auth client
 * - Session management and navigation
 * 
 * The form handles the user registration flow and provides
 * appropriate feedback during the process.
 */
'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Controller, useForm } from 'react-hook-form';
import { z as zod } from 'zod';

import { paths } from '@/paths';
import { authClient } from '@/lib/auth/custom/client';
import { useUser } from '@/hooks/use-user';
import { DynamicLogo } from '@/components/core/logo';
import { toast } from '@/components/core/toaster';
import { GitHubOAuthButton } from '@/components/auth/github-oauth-button';

/**
 * Form validation schema using Zod
 * Validates that:
 * - First name is required
 * - Last name is required
 * - Email is required and valid format
 * - Password is at least 6 characters
 * - Terms acceptance via footer text
 */
const schema = zod.object({
  email: zod.string().min(1, { message: 'Email is required' }).email(),
  password: zod.string().min(6, { message: 'Password should be at least 6 characters' }),
});

/**
 * Default form values
 * Initializes all form fields as empty strings
 */
const defaultValues = { 
  email: '', 
  password: ''
};

/**
 * Sign Up Form Component
 * 
 * @returns {JSX.Element} The sign up form interface
 */
export function SignUpForm() {
  const router = useRouter();
  const { checkSession } = useUser();

  // Loading state for form submission
  const [isPending, setIsPending] = React.useState(false);

  // Form state management with React Hook Form
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ defaultValues, resolver: zodResolver(schema) });

  /**
   * Form submission handler
   * Processes the sign up request and handles navigation
   * @param {Object} values - Form values containing user registration data
   */
  const onSubmit = React.useCallback(
    async (values) => {
      setIsPending(true);
      values.firstName = values.email.split('@')[0];
      values.lastName = '';

      const { error } = await authClient.signUp(values);

      if (error) {
        // Provide user-friendly error messages
        let errorMessage = error;
        if (error.includes('Email already registered')) {
          errorMessage = 'An account with this email address already exists. Please try signing in instead.';
        }
        
        setError('root', { type: 'server', message: errorMessage });
        setIsPending(false);
        return;
      }
      setIsPending(false);

      // Refresh the auth state
      await checkSession?.();

      // UserProvider, for this case, will not refresh the router
      // After refresh, GuestGuard will handle the redirect
      router.push(paths.home);
    },
    [checkSession, router, setError]
  );

  return (
    <Stack 
      spacing={4}
      sx={{
        minHeight: '100vh',
        justifyContent: 'center',
        py: 4
      }}
    >


      {/* Form Header with Sign In Link */}
      <Stack spacing={1}>
        <Typography variant="h5">Sign up</Typography>
        <Typography color="text.secondary" variant="body2">
          Already have an account?{' '}
          <Link component={RouterLink} href={paths.auth.custom.signIn} variant="subtitle2">
            Sign in
          </Link>
        </Typography>
      </Stack>

      {/* Registration Form */}
      <Stack spacing={3}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={2}>
            {/* First Name Input */}
          

            {/* Email Input */}
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <FormControl error={Boolean(errors.email)}>
                  <InputLabel>Email address</InputLabel>
                  <OutlinedInput {...field} type="email" />
                  {errors.email ? <FormHelperText>{errors.email.message}</FormHelperText> : null}
                </FormControl>
              )}
            />

            {/* Password Input */}
            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <FormControl error={Boolean(errors.password)}>
                  <InputLabel>Password</InputLabel>
                  <OutlinedInput {...field} type="password" />
                  {errors.password ? <FormHelperText>{errors.password.message}</FormHelperText> : null}
                </FormControl>
              )}
            />


            {/* Server Error Display */}
            {errors.root ? (
              <Alert color="error">
                {errors.root.message}
                {errors.root.message.includes('already exists') && (
                  <Box sx={{ mt: 1 }}>
                    <Link component={RouterLink} href={paths.auth.custom.signIn} color="inherit">
                      Go to Sign In
                    </Link>
                  </Box>
                )}
              </Alert>
            ) : null}
            <Button disabled={isPending} type="submit" variant="contained"
              sx={{
                backgroundImage: 'none',  // Remove gradient
                backgroundColor: 'primary.main',  // Use solid color
                '&:hover': {
                  backgroundImage: 'none',
                  backgroundColor: 'primary.light',
                },
              }}>
              Create account
            </Button>
          </Stack>
        </form>

        {/* GitHub OAuth Button */}
        <GitHubOAuthButton 
          fullWidth 
          showDivider 
        />

        {/* Footer with acceptance text */}
        <Typography variant="caption" sx={{ 
          color: '#9ca3af', 
          textAlign: 'center',
          mt: 2,
          mr: 6,
          ml: 6,
          fontSize: '0.75rem'
        }}>
          By signing up, you agree to our{' '}
          <Link 
            href="/terms-of-use" 
            target="_blank" 
            rel="noopener noreferrer"
            sx={{ color: 'primary.main', textDecoration: 'none' }}
          >
            Terms of Use
          </Link>
          {' '}and{' '}
          <Link 
            href="/privacy-policy" 
            target="_blank" 
            rel="noopener noreferrer"
            sx={{ color: 'primary.main', textDecoration: 'none' }}
          >
            Privacy Policy
          </Link>
        </Typography>
      </Stack>
    </Stack>
  );
}
