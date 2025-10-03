import { Router } from 'express';
import { getDashboardEventsSnapshot, getDashboardMetricsSnapshot } from '../services/dashboardService.js';

const router = Router();

router.get('/metrics', async (_req, res) => {
  const snapshot = await getDashboardMetricsSnapshot();
  res.json(snapshot);
});

router.get('/events', async (_req, res) => {
  const events = await getDashboardEventsSnapshot();
  res.json(events);
});

export default router;
