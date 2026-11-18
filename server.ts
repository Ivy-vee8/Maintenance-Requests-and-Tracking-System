import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api.ts';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '4mb' }));
  app.use('/api', apiRouter);

  // Return JSON 404 for unknown API routes instead of falling through to SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Structured JSON error handler for malformed JSON bodies or payload size limits
  app.use(
    (
      err: Error & { status?: number; type?: string },
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (res.headersSent) {
        next(err);
        return;
      }
      if (err.type === 'entity.too.large') {
        res.status(413).json({ error: 'Request payload exceeds the 4 MB limit.' });
        return;
      }
      if (err instanceof SyntaxError && err.status === 400) {
        res.status(400).json({ error: 'Malformed JSON request body.' });
        return;
      }
      console.error('[MRTMIS Server] Unhandled error:', err.message);
      res.status(err.status || 500).json({ error: 'Internal server error.' });
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      console.warn(
        '[MRTMIS Server] Warning: dist/index.html not found. Run "npm run build" before starting in production mode.'
      );
    }
    app.use(express.static(distDir, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => {
      if (!fs.existsSync(indexHtml)) {
        res.status(503).send('Application bundle is not built yet. Run "npm run build" first.');
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MRTMIS server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
