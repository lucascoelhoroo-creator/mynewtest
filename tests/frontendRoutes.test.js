import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';

const TEST_CONFIG_PATH = resolve('data/test-config-frontend.json');
process.env.CONFIG_PATH = TEST_CONFIG_PATH;
process.env.NODE_ENV = 'test';

const { defaultConfig } = await import('../src/config/defaultConfig.js');
const { getDashboardMetricsSnapshot, getDashboardEventsSnapshot } = await import(
  '../src/services/dashboardService.js'
);

function cloneDefaultConfig() {
  if (typeof structuredClone === 'function') {
    return structuredClone(defaultConfig);
  }
  return JSON.parse(JSON.stringify(defaultConfig));
}

async function resetConfig(overrides = {}) {
  const config = cloneDefaultConfig();
  for (const [key, value] of Object.entries(overrides)) {
    config[key] = value;
  }
  await mkdir(dirname(TEST_CONFIG_PATH), { recursive: true });
  await writeFile(TEST_CONFIG_PATH, JSON.stringify(config, null, 2));
}

test('index.html contém a seção do novo dashboard e carrega os assets principais', async () => {
  const html = await readFile('index.html', 'utf-8');
  assert.match(html, /id="dashboard"/);
  assert.match(html, /Dashboard de Monitoramento/);
  assert.match(html, /src\/frontend\/main.js/);
  assert.match(html, /src\/frontend\/styles.css/);
});

test('snapshot de métricas calcula totais e servidores conectados', async () => {
  await resetConfig({
    sessions: {
      sess1: { createdAt: '2024-01-01T00:00:00.000Z' },
      sess2: { createdAt: '2024-01-02T00:00:00.000Z' }
    },
    events: [
      { type: 'routing.decision', timestamp: '2024-01-03T00:00:00.000Z' },
      { type: 'routing.decision', timestamp: '2024-01-03T00:01:00.000Z' },
      { type: 'webhook.order_paid', timestamp: '2024-01-03T00:02:00.000Z' },
      { type: 'webhook.order_failed', timestamp: '2024-01-03T00:03:00.000Z' }
    ],
    edgeWorkers: [{ id: 'edge-1', endpointUrl: 'https://worker.example/intercept' }]
  });

  const snapshot = await getDashboardMetricsSnapshot();
  assert.equal(snapshot.totals.initiated, 2);
  assert.equal(snapshot.totals.redirectReady, 2);
  assert.equal(snapshot.totals.paid, 1);
  assert.equal(snapshot.totals.failed, 1);
  assert.equal(snapshot.edgeWorkersConnected, 1);
});

test('snapshot de eventos retorna a lista em ordem reversa com limite', async () => {
  await resetConfig({
    events: [
      { type: 'routing.decision', timestamp: '2024-01-01T00:00:00.000Z' },
      { type: 'webhook.order_paid', timestamp: '2024-01-02T00:00:00.000Z' },
      { type: 'webhook.order_failed', timestamp: '2024-01-03T00:00:00.000Z' }
    ]
  });

  const events = await getDashboardEventsSnapshot(10);
  assert.equal(events.length, 3);
  assert.equal(events[0].type, 'webhook.order_failed');
  assert.equal(events[2].type, 'routing.decision');
});

test('script principal da interface existe e possui rotina do dashboard', async () => {
  const script = await readFile('src/frontend/main.js', 'utf-8');
  assert.match(script, /function renderMetrics/);
  assert.match(script, /refreshDashboard/);
});

test.after(async () => {
  await rm(TEST_CONFIG_PATH, { force: true });
});
