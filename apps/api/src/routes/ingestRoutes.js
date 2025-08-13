import express from 'express';
import bodyParser from 'body-parser';

const router = express.Router();

// Public endpoint: ingest events (supports gzip + JSONL/NDJSON)
router.post('/events', bodyParser.raw({ type: '*/*', limit: '500mb' }), async (req, res) => {
  try {
    console.log('api/ingest/events headers:', req.headers);
    // Note: body-parser inflates gzip/deflate by default. req.body is already a Buffer of decompressed bytes.
    const rawBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const text = rawBuffer.toString('utf-8');

    // Log the decompressed text as-is (JSONL/NDJSON supported)
    console.log('api/ingest/events body (decompressed):');
    console.log(text);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error handling ingest event:', error);
    res.status(500).json({ success: false, error: 'Failed to handle ingest event' });
  }
});

export default router;


