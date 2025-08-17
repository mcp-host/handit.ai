import express from 'express';
import crypto from 'crypto';
import { Storage } from '@google-cloud/storage';

const router = express.Router();

const storage = new Storage();
const BUCKET = process.env.LOGS_BUCKET || '';

// Public endpoint: ultra-fast ingest — streams request body directly to GCS
router.post('/events', async (req, res) => {
  if (!BUCKET) {
    return res.status(500).json({ ok: false, error: 'LOGS_BUCKET not configured' });
  }

  try {
    // Extract auth token (Bearer or raw). Use a short hash for partitioning to avoid storing raw secrets
    const authHeader = (req.headers['authorization'] || '').toString();
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const tokenHash = token ? token : 'anon';

    const objectName = `ingest/auth=${tokenHash}/${Date.now()}_${crypto.randomUUID()}.jsonl.gz`;

    const bucket = storage.bucket(BUCKET);
    const file = bucket.file(objectName);

    const writeStream = file.createWriteStream({
      resumable: true,
      contentType: 'application/x-ndjson',
      metadata: {
        contentEncoding: 'gzip',
        metadata: { tokenHash },
      },
      ifGenerationMatch: 0,
    });

    req.on('aborted', () => writeStream.destroy(new Error('client aborted')));

    writeStream.on('error', (err) => {
      console.error('GCS write error:', err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: 'upload failed' });
    });

    writeStream.on('finish', async () => {
      try {
        return res.status(200).json({ ok: true, object: objectName });
      } catch (e) {
        console.error('Post-upload step failed:', e);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'post-upload failed' });
      }
    });

    // Stream request body directly to GCS (supports large payloads efficiently)
    req.pipe(writeStream);
  } catch (error) {
    console.error('Error handling ingest event:', error);
    if (!res.headersSent) res.status(500).json({ ok: false, error: 'Failed to handle ingest event' });
  }
});

export default router;


