import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function criarApp(pecas) {
  const app = express();
  app.use(express.json());
  app.get('/saude', (req, res) => res.json({ ok: true }));
  app.use(express.static(join(__dirname, '..', 'public')));
  return app;
}
