import express from 'express';
import { 
  initiateGitHubAuth,
  handleGitHubCallback,
  handleGitHubWebhook,
  getGitHubIntegrations,
  updateGitHubIntegration,
  testGitHubIntegration,
  deleteGitHubIntegration
} from '../controllers/githubController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/auth', initiateGitHubAuth);
router.get('/callback', handleGitHubCallback);
router.post('/webhook', handleGitHubWebhook);

// Protected routes (require authentication)
router.get('/integrations', authenticateJWT, getGitHubIntegrations);
router.put('/integrations/:id', authenticateJWT, updateGitHubIntegration);
router.post('/integrations/:id/test', authenticateJWT, testGitHubIntegration);
router.delete('/integrations/:id', authenticateJWT, deleteGitHubIntegration);

export default router; 