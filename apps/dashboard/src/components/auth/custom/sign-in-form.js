/**
 * Custom Sign In Form Component
 * 
 * A form component that handles user authentication using custom credentials.
 * This component implements a secure sign-in process with email and password validation,
 * error handling, and integration with the application's authentication system.
 * 
 * Features:
 * 1. Form validation using Zod schema
 * 2. Password visibility toggle
 * 3. Error handling and display
 * 4. Integration with Redux for state management
 * 5. Google Analytics event tracking
 * 6. Sandbox mode support for development
 * 
 * @module SignInForm
 */

'use client';

import * as React from 'react';
import RouterLink from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Link from '@mui/material/Link';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Eye as EyeIcon } from '@phosphor-icons/react/dist/ssr/Eye';
import { EyeSlash as EyeSlashIcon } from '@phosphor-icons/react/dist/ssr/EyeSlash';
import { Controller, useForm } from 'react-hook-form';
import { z as zod } from 'zod';

import { paths } from '@/paths';
import { authClient } from '@/lib/auth/custom/client';
import { useUser } from '@/hooks/use-user';
import { useDispatch } from 'react-redux';
import { store } from '@/store';
import { isSandboxPage } from '@/lib/sandbox';
import { event } from '@/lib/gtag';
import { GitHubOAuthButton } from '@/components/auth/github-oauth-button';

/**
 * Validation schema for the sign-in form
 * Ensures email is valid and password is provided
 */
const schema = zod.object({
  email: zod.string().min(1, { message: 'Email is required' }).email(),
  password: zod.string().min(1, { message: 'Password is required' }),
});

/**
 * Default form values
 */
const defaultValues = { email: '', password: '' };

/**
 * Sign In Form Component
 * 
 * Renders a form for user authentication with:
 * - Email input with validation
 * - Password input with visibility toggle
 * - Error handling and display
 * - Submit button with loading state
 * 
 * @returns {JSX.Element} The sign-in form component
 * 
 * @example
 * // The form is typically used within an authentication page
 * <SignInForm />
 */
export function SignInForm() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { checkSession } = useUser();

  // State for password visibility and form submission
  const [showPassword, setShowPassword] = React.useState();
  const [isPending, setIsPending] = React.useState(false);

  // Form setup with validation
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ defaultValues, resolver: zodResolver(schema) });

  /**
   * Handles form submission
   * Attempts to sign in the user and handles the response
   * 
   * @param {Object} values - Form values containing email and password
   */
  const onSubmit = React.useCallback(
    async (values) => {
      setIsPending(true);

      // Attempt to sign in
      const { error } = await authClient.signInWithPassword(values);
      if (error) {
        setError('root', { type: 'server', message: 'Invalid Credentials' });
        setIsPending(false);
        return;
      }

      // Verify session and handle authentication
      let data = await checkSession?.();
      await setTimeout(async () => {
        data = await checkSession?.();
      }, 1000);

      if (!data) {
        setError('root', { type: 'server', message: 'Invalid Credentials' });
        setIsPending(false);
        return;
      }

      // Track successful login
      event({
        action: 'login',
        params: { email: data.email, user: data.id },
      })
      // UserProvider, for this case, will not refresh the router
      // After refresh, GuestGuard will handle the redirect
      router.refresh();
    },
    [checkSession, router, setError]
  );

  // Check for sandbox mode on component mount
  React.useState(() => {
    const checkUser = async () => {
      if (isSandboxPage(window)) {
        store.dispatch({ type: 'auth/setSandboxCredentials' });
        await checkSession();
        router.refresh();
      }
    }
    checkUser();
  });

  return (
    <Stack spacing={4}>
      <div>
        {/* Header section */}
      </div>
      <Stack spacing={1}>
        <Typography variant="h5">Sign in</Typography>
        <Typography color="text.secondary" variant="body2">
          Don&apos;t have an account?{' '}
          <Link component={RouterLink} href={paths.auth.custom.signUp} variant="subtitle2">
            Sign up
          </Link>
        </Typography>
      </Stack>
      <Stack spacing={3}>
        <Stack spacing={2}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2}>
              {/* Email input field */}
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

              {/* Password input field with visibility toggle */}
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <FormControl error={Boolean(errors.password)}>
                    <InputLabel>Password</InputLabel>
                    <OutlinedInput
                      {...field}
                      endAdornment={
                        showPassword ? (
                          <EyeIcon
                            cursor="pointer"
                            fontSize="var(--icon-fontSize-md)"
                            onClick={() => {
                              setShowPassword(false);
                            }}
                          />
                        ) : (
                          <EyeSlashIcon
                            cursor="pointer"
                            fontSize="var(--icon-fontSize-md)"
                            onClick={() => {
                              setShowPassword(true);
                            }}
                          />
                        )
                      }
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                    />
                    {errors.password ? <FormHelperText>{errors.password.message}</FormHelperText> : null}
                  </FormControl>
                )}
              />

              {/* Error display */}
              {errors.root ? <Alert color="error">{errors.root.message}</Alert> : null}

              {/* Submit button */}
              <Button
                disabled={isPending}
                type="submit"
                variant="contained"
                sx={{
                  backgroundImage: 'none',  // Remove gradient
                  backgroundColor: 'primary.main',  // Use solid color
                  '&:hover': {
                    backgroundImage: 'none',
                    backgroundColor: 'primary.light',
                  },
                }}
              >
                Sign in
              </Button>
            </Stack>
          </form>
        </Stack>

        {/* GitHub OAuth Button */}
        <GitHubOAuthButton 
          fullWidth 
          showDivider 
        />
        <Typography variant="caption" sx={{ 
          color: '#9ca3af', 
          textAlign: 'center',
          mt: 2,
          mr: 6,
          ml: 6,
          fontSize: '0.75rem'
        }}>
          By signing in, you agree to our{' '}
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
