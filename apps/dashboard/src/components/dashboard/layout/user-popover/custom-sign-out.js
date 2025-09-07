/**
 * @fileoverview Custom Sign Out Component
 * 
 * This component implements a sign out functionality for custom authentication.
 * It handles the sign out process, error handling, and UI feedback.
 * 
 * Features:
 * - Integrates with custom authentication client
 * - Provides error handling and user feedback via toast notifications
 * - Refreshes authentication state and router after sign out
 * - Uses Material-UI MenuItem for consistent UI
 * 
 * @example
 * // Usage in a menu or navigation component:
 * <CustomSignOut />
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import MenuItem from '@mui/material/MenuItem';

import { authClient } from '@/lib/auth/custom/client';
import { logger } from '@/lib/default-logger';
import { useUser } from '@/hooks/use-user';
import { toast } from '@/components/core/toaster';
import { paths } from '@/paths';

/**
 * CustomSignOut Component
 * 
 * A menu item component that handles the sign out process for custom authentication.
 * It provides visual feedback and error handling during the sign out process.
 * 
 * @returns {JSX.Element} A MenuItem component that triggers the sign out process when clicked
 */
export function CustomSignOut() {
  const { checkSession } = useUser();
  const router = useRouter();

  /**
   * Handles the sign out process
   * 
   * This function:
   * 1. Attempts to sign out using the custom auth client
   * 2. Handles any errors that occur during sign out
   * 3. Refreshes the authentication state
   * 4. Updates the router to reflect the new authentication state
   * 
   * @async
   * @function handleSignOut
   */
  const handleSignOut = React.useCallback(async () => {
    try {
      const { error } = await authClient.signOut();

      if (error) {
        logger.error('Sign out error', error);
        toast.error('Something went wrong, unable to sign out');
        return;
      }

      // Clear any onboarding state
      localStorage.removeItem('onboardingState');
      sessionStorage.clear();

      // Force redirect to sign-in page
      window.location.href = paths.auth.custom.signIn;

    } catch (err) {
      logger.error('Sign out error', err);
      toast.error('Something went wrong, unable to sign out');
      // Even if sign out fails, redirect to sign-in page
      window.location.href = paths.auth.custom.signIn;
    }
  }, []);

  return (
    <MenuItem component="div" onClick={handleSignOut} sx={{ justifyContent: 'center' }}>
      Sign out
    </MenuItem>
  );
}
