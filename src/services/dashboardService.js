import { getConfig, getEvents, getSessions } from '../lib/storage.js';

export async function getDashboardMetricsSnapshot() {
  const config = await getConfig();
  const sessions = await getSessions();
  const totals = {
    initiated: Object.keys(sessions).length,
    redirectReady: config.events.filter((event) => event.type === 'routing.decision').length,
    paid: config.events.filter((event) => event.type === 'webhook.order_paid').length,
    failed: config.events.filter((event) => event.type === 'webhook.order_failed').length
  };

  return {
    totals,
    edgeWorkersConnected: config.edgeWorkers.length
  };
}

export async function getDashboardEventsSnapshot(limit = 50) {
  return getEvents(limit);
}
