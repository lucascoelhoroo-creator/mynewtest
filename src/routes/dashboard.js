import { Router } from 'express';
import { getConfig, getEvents, getSessions } from '../lib/storage.js';

const router = Router();

router.get('/metrics', async (_req, res) => {
  const config = await getConfig();
  const sessions = await getSessions();
  const totals = {
    initiated: Object.keys(sessions).length,
    redirectReady: config.events.filter((e) => e.type === 'routing.decision').length,
    paid: config.events.filter((e) => e.type === 'webhook.order_paid').length,
    failed: config.events.filter((e) => e.type === 'webhook.order_failed').length
  };
  res.json({ totals, edgeWorkersConnected: config.edgeWorkers.length });
});

router.get('/events', async (_req, res) => {
  const events = await getEvents();
  res.json(events);
});

export default router;
