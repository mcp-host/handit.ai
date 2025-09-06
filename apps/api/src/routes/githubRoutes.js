import express from 'express';
import { 
  initiateGitHubAuth,
  handleGitHubCallback,
  handleGitHubWebhook,
  getGitHubIntegrations,
  updateGitHubIntegration,
  testGitHubIntegration,
  deleteGitHubIntegration,
  assessRepoAndCreatePR,
  assessRepoAndSetupHandit,
  listInstallationRepositories,
  getRepositoryFiles,
  getRepositoryBranches,
  redirectToAssessmentByEmail,
  getUserPullRequests
} from '../controllers/githubController/githubController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/auth', initiateGitHubAuth);
router.get('/callback', handleGitHubCallback);
router.post('/webhook', handleGitHubWebhook);
router.post('/assess-and-pr', assessRepoAndCreatePR);
router.get('/installation-repos', listInstallationRepositories);
router.get('/repository-files', getRepositoryFiles);
router.get('/repository-branches', getRepositoryBranches);
router.get('/redirect-by-email', redirectToAssessmentByEmail);

// Protected routes (require authentication)
router.get('/integrations', authenticateJWT, getGitHubIntegrations);
router.put('/integrations/:id', authenticateJWT, updateGitHubIntegration);
router.post('/integrations/:id/test', authenticateJWT, testGitHubIntegration);
router.delete('/integrations/:id', authenticateJWT, deleteGitHubIntegration);
router.post('/assess-and-setup-handit', authenticateJWT, assessRepoAndSetupHandit);
router.get('/pull-requests', authenticateJWT, getUserPullRequests);

export default router; 