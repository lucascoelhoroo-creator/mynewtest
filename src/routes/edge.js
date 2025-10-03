import { Router } from 'express';
import { decideRouting } from '../services/routingService.js';
import { pushEvent, recordSession } from '../lib/storage.js';

const router = Router();

router.post('/intercept', async (req, res) => {
  const payload = req.body;
  if (!payload.product_x_id) {
    return res.status(400).json({ message: 'product_x_id is required' });
  }

  try {
    const decision = await decideRouting(payload);
    if (decision.status !== 'ready') {
      return res.status(202).json(decision);
    }

    await pushEvent({
      type: 'consent.presented',
      sessionId: decision.sessionId,
      checkoutId: decision.checkoutId
    });

    res.json(decision);
  } catch (error) {
    await pushEvent({
      type: 'routing.error',
      error: error.message,
      sessionId: payload.session_id_a
    });
    res.status(500).json({ message: 'Routing error', detail: error.message });
  }
});

router.post('/consent/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { consented } = req.body;
  await recordSession(sessionId, {
    consented,
    consentedAt: consented ? new Date().toISOString() : undefined,
    status: consented ? 'consented' : 'cancelled'
  });
  await pushEvent({ type: 'consent.recorded', sessionId, consented });
  res.status(200).json({ message: 'Consent recorded' });
});

export default router;
