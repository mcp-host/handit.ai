import express from 'express';
import db from '../../models/index.js';
import { repositionAgentNodes } from '../services/agentNodeService.js';

const router = express.Router();

// Public (no auth) endpoint to reposition nodes for a given agentId
router.post('/reposition/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    if (!agentId) {
      return res.status(400).json({ success: false, error: 'agentId is required' });
    }

    const agent = await db.Agent.findByPk(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    await repositionAgentNodes(agent);
    return res.status(200).json({ success: true, message: 'Agent nodes repositioned' });
  } catch (error) {
    console.error('Error repositioning agent nodes:', error);
    return res.status(500).json({ success: false, error: 'Failed to reposition agent nodes' });
  }
});

export default router;


