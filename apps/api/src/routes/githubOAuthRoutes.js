import express from 'express';
import {
  initiateGitHubOAuth,
  handleGitHubOAuthCallback,
  getUserInstallations,
  linkUserToCompany,
  createCompanyForInstallation,
  getGitHubOAuthConfig,
} from '../controllers/githubOAuthController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/auth', initiateGitHubOAuth);
router.get('/callback', handleGitHubOAuthCallback);
router.get('/config', getGitHubOAuthConfig);

// Protected routes (authentication required)
router.get('/installations', authenticateJWT, getUserInstallations);
router.post('/link-company', authenticateJWT, linkUserToCompany);
router.post('/create-company', authenticateJWT, createCompanyForInstallation);

export default router;
