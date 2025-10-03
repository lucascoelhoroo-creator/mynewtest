import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import onboardingRoutes from './routes/onboarding.js';
import edgeRoutes from './routes/edge.js';
import dashboardRoutes from './routes/dashboard.js';
import webhookRoutes from './webhooks/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendDir = path.join(__dirname, 'frontend');
const rootIndexPath = path.join(__dirname, '..', 'index.html');

export function createApp() {
  const app = express();
  app.use(express.json());

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  const api = express.Router();
  api.use('/onboarding', onboardingRoutes);
  api.use('/edge', edgeRoutes);
  api.use('/dashboard', dashboardRoutes);
  api.use('/webhooks', webhookRoutes);

  app.use('/api', api);

  app.use(express.static(frontendDir));
  app.use('/src/frontend', express.static(frontendDir));

  app.get('*', (_req, res) => {
    res.sendFile(rootIndexPath);
  });

  return app;
}
