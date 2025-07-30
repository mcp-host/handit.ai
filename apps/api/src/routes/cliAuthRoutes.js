import express from 'express';
import { 
  generateCLICode, 
  checkCLIStatus, 
  approveCLICode, 
  getPendingCLICodes,
  cleanupExpiredCodes 
} from '../controllers/cliAuthController.js';
import authenticateJWT from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/generate', generateCLICode);
router.post('/status', checkCLIStatus);

// Protected routes (require authentication)
router.get('/pending', authenticateJWT, getPendingCLICodes);
router.post('/approve/:code', authenticateJWT, approveCLICode);

// Admin route for cleanup (can be called by cron job)
router.post('/cleanup', cleanupExpiredCodes);

export default router; 