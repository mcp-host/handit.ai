/**
 * @fileoverview CLI Authentication Page
 * 
 * This page implements the CLI authentication functionality.
 * It provides a public route that allows users to generate CLI authentication codes
 * without requiring prior authentication.
 * 
 * Features:
 * - Public access (no authentication required)
 * - Split layout design for better UX
 * - CLI authentication form
 * - SEO-friendly metadata
 * 
 * @example
 * // The page will be accessible at:
 * // /cli-auth
 */

import * as React from 'react';

import { config } from '@/config';
import { CLIAuthForm } from '@/components/cli-auth/cli-auth-form';
import { SplitLayout } from '@/components/auth/split-layout';

/**
 * Page metadata for SEO and browser tab title
 * 
 * @type {Object}
 * @property {string} title - The page title in format "CLI Authentication | {siteName}"
 */
export const metadata = { title: `CLI Authentication | ${config.site.name}` };

/**
 * CLI Authentication Page Component
 * 
 * Renders the CLI authentication page with the following structure:
 * - SplitLayout: Provides a two-column layout
 * - CLIAuthForm: The main CLI authentication form
 * 
 * @returns {JSX.Element} The CLI authentication page component
 */
export default function Page() {
  return (
    <SplitLayout>
      <CLIAuthForm />
    </SplitLayout>
  );
} 