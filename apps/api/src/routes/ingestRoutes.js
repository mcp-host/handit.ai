import express from 'express';
import bodyParser from 'body-parser';
import zlib from 'zlib';

const router = express.Router();

// Public endpoint: ingest events (supports gzip + JSONL/NDJSON)
router.post('/events', bodyParser.raw({ type: '*/*', limit: '500mb' }), async (req, res) => {
  try {
    const isGzip = (req.headers['content-encoding'] || '').toLowerCase() === 'gzip';
    const rawBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const payloadBuffer = isGzip ? zlib.gunzipSync(rawBuffer) : rawBuffer;
    const text = payloadBuffer.toString('utf-8');

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


