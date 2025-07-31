/**
 * @fileoverview Prompt Optimization Routes
 * 
 * Routes for testing and managing prompt optimization features.
 * These endpoints allow manual testing of GitHub PR creation
 * and monitoring of prompt optimization status.
 * 
 * Features:
 * - Test PR creation
 * - Agent status monitoring
 * - Repository configuration listing
 */

import express from 'express';
import { 
  testPromptOptimizationPR, 
  getPromptOptimizationStatus,
  listAgentsWithRepositories 
} from '../controllers/promptOptimizationController.js';
import { authenticateJWT } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @route POST /api/prompt-optimization/test-pr
 * @desc Test prompt optimization PR creation
 * @access Private
 * @body {
 *   agentId: number,
 *   originalPrompt: string,
 *   optimizedPrompt: string,
 *   metrics?: {
 *     accuracy?: number,
 *     improvement?: number,
 *     totalEvaluations?: number,
 *     successfulEvaluations?: number
 *   }
 * }
 */
router.post('/test-pr', authenticateJWT, testPromptOptimizationPR);

/**
 * @route GET /api/prompt-optimization/status/:agentId
 * @desc Get prompt optimization status for a specific agent
 * @access Private
 * @param {number} agentId - The agent ID to check status for
 */
router.get('/status/:agentId', authenticateJWT, getPromptOptimizationStatus);

/**
 * @route GET /api/prompt-optimization/agents
 * @desc List all agents with their repository configuration status
 * @access Private
 */
router.get('/agents', authenticateJWT, listAgentsWithRepositories);

export default router;