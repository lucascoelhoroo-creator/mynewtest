import { Router } from 'express';
import { pushEvent, recordSession } from '../lib/storage.js';

const router = Router();

router.post('/checkout-update', async (req, res) => {
  const { id, status, ab_jump_session_id: sessionId } = req.body;
  if (sessionId) {
    await recordSession(sessionId, { checkoutStatus: status });
  }
  await pushEvent({ type: 'webhook.checkout_update', checkoutId: id, status, sessionId });
  res.status(200).json({ received: true });
});

router.post('/order-paid', async (req, res) => {
  const { id, sessionId, orderNumber } = req.body;
  if (sessionId) {
    await recordSession(sessionId, { status: 'paid', orderId: id, orderNumber });
  }
  await pushEvent({ type: 'webhook.order_paid', orderId: id, sessionId, orderNumber });
  res.status(200).json({ received: true });
});

router.post('/order-failed', async (req, res) => {
  const { id, sessionId, reason } = req.body;
  if (sessionId) {
    await recordSession(sessionId, { status: 'failed', failureReason: reason });
  }
  await pushEvent({ type: 'webhook.order_failed', orderId: id, sessionId, reason });
  res.status(200).json({ received: true });
});

export default router;
