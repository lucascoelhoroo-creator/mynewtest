import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const TEST_CONFIG_PATH = resolve('data/test-config.json');
process.env.CONFIG_PATH = TEST_CONFIG_PATH;

const { decideRouting, generateTestCheckoutLink } = await import('../src/services/routingService.js');
const { getConfig } = await import('../src/lib/storage.js');

async function writeConfig(config) {
  await mkdir(dirname(TEST_CONFIG_PATH), { recursive: true });
  await writeFile(TEST_CONFIG_PATH, JSON.stringify(config, null, 2));
}

test('decideRouting returns unmapped when no mapping is configured', async () => {
  await writeConfig({
    shops: { siteA: [], siteB: [] },
    productMappings: [],
    edgeWorkers: [],
    sessions: {},
    events: []
  });

  const result = await decideRouting({
    product_x_id: 'prod-1',
    session_id_a: 'sess-1'
  });

  assert.equal(result.status, 'unmapped');
  const config = await getConfig();
  assert.equal(config.events.at(-1).reason, 'mapping_not_found');
});

test('decideRouting returns ready result for mapped products', async () => {
  await writeConfig({
    shops: {
      siteA: [
        { shopDomain: 'store-a.myshopify.com', adminAccessToken: null }
      ],
      siteB: [
        { shopDomain: 'store-b.myshopify.com', adminAccessToken: null }
      ]
    },
    productMappings: [
      {
        id: 'map-1',
        siteAShopDomain: 'store-a.myshopify.com',
        siteAProductId: 'prod-1',
        siteBShopDomain: 'store-b.myshopify.com',
        siteBProductId: 'gid://shopify/Product/1'
      }
    ],
    edgeWorkers: [
      { id: 'edge-1', label: 'Edge BR', endpointUrl: 'https://edge.example/intercept' }
    ],
    sessions: {},
    events: []
  });

  const result = await decideRouting({
    product_x_id: 'prod-1',
    quantity: 2,
    session_id_a: 'sess-2'
  });

  assert.equal(result.status, 'ready');
  assert.equal(result.checkoutUrl, 'https://store-b.myshopify.com/checkout/sess-2');
  assert.equal(result.edgeWorker.id, 'edge-1');

  const config = await getConfig();
  assert.ok(config.sessions['sess-2']);
  assert.equal(config.sessions['sess-2'].checkoutId, 'gid://shopify/Checkout/sess-2');
  assert.equal(config.sessions['sess-2'].edgeWorkerId, 'edge-1');
});

test('generateTestCheckoutLink fails when mapping is missing', async () => {
  await writeConfig({
    shops: { siteA: [], siteB: [] },
    productMappings: [],
    edgeWorkers: [],
    sessions: {},
    events: []
  });

  await assert.rejects(() => generateTestCheckoutLink('missing'), {
    message: 'Mapeamento não encontrado'
  });
});

after(async () => {
  await rm(TEST_CONFIG_PATH, { force: true });
});
