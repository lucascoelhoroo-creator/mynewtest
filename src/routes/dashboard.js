import { Router } from 'express';
import { getConfig, getEvents, getSessions } from '../lib/storage.js';

const router = Router();

router.get('/metrics', async (_req, res) => {
  const config = await getConfig();
  const sessions = await getSessions();
  const totals = {
    initiated: Object.keys(sessions).length,
    consented: Object.values(sessions).filter((s) => s.consented).length,
    redirected: config.events.filter((e) => e.type === 'routing.decision').length,
    paid: config.events.filter((e) => e.type === 'webhook.order_paid').length,
    failed: config.events.filter((e) => e.type === 'webhook.order_failed').length
  };
  res.json({ totals, consentCopyConfigured: !!config.consent?.message });
});

router.get('/events', async (_req, res) => {
  const events = await getEvents();
  res.json(events);
});

export default router;
