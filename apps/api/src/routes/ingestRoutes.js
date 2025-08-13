import express from 'express';

const router = express.Router();

// Public endpoint: ingest events
router.post('/events', async (req, res) => {
  try {
    // Print the incoming body
    console.log('api/ingest/events body:', req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling ingest event:', error);
    res.status(500).json({ success: false, error: 'Failed to handle ingest event' });
  }
});

export default router;


