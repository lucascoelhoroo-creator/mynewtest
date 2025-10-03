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

const app = express();
app.use(express.json());
app.use(morgan('dev'));

const api = express.Router();
api.use('/onboarding', onboardingRoutes);
api.use('/edge', edgeRoutes);
api.use('/dashboard', dashboardRoutes);
api.use('/webhooks', webhookRoutes);

app.use('/api', api);

app.use(express.static(path.join(__dirname, 'frontend')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`AB Jump prototype running on http://localhost:${port}`);
});
