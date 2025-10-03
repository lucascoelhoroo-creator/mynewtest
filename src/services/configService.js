import { getConfig, updateConfig } from '../lib/storage.js';

function upsert(list, item, key = 'id') {
  const index = list.findIndex((entry) => entry[key] === item[key]);
  if (index >= 0) {
    list[index] = { ...list[index], ...item };
  } else {
    list.push(item);
  }
}

export async function listShops() {
  const config = await getConfig();
  return config.shops;
}

export async function connectShop(shop) {
  await updateConfig((config) => {
    const bucket = shop.role === 'siteB' ? config.shops.siteB : config.shops.siteA;
    upsert(bucket, shop, 'shopDomain');
  });
}

export async function listProductMappings() {
  const config = await getConfig();
  return config.productMappings;
}

export async function saveProductMapping(mapping) {
  await updateConfig((config) => {
    upsert(config.productMappings, mapping, 'id');
  });
}

export async function deleteProductMapping(id) {
  await updateConfig((config) => {
    const index = config.productMappings.findIndex((m) => m.id === id);
    if (index >= 0) {
      config.productMappings.splice(index, 1);
    }
  });
}

export async function listEdgeWorkers() {
  const config = await getConfig();
  return config.edgeWorkers;
}

export async function saveEdgeWorker(worker) {
  await updateConfig((config) => {
    upsert(config.edgeWorkers, worker, 'id');
  });
}

export async function deleteEdgeWorker(id) {
  await updateConfig((config) => {
    const index = config.edgeWorkers.findIndex((worker) => worker.id === id);
    if (index >= 0) {
      config.edgeWorkers.splice(index, 1);
    }
  });
}

export async function getOnboardingStatus() {
  const config = await getConfig();
  const siteAConnected = config.shops.siteA.length > 0;
  const siteBConnected = config.shops.siteB.length > 0;
  const mappingsReady = config.productMappings.some(
    (mapping) =>
      config.shops.siteA.some((shop) => shop.shopDomain === mapping.siteAShopDomain) &&
      config.shops.siteB.some((shop) => shop.shopDomain === mapping.siteBShopDomain)
  );
  const workersConnected = config.edgeWorkers.length > 0;
  const cloudflareConnected = Boolean(config.cloudflareAccount);
  const ready = siteAConnected && siteBConnected && mappingsReady;
  return {
    siteAConnected,
    siteBConnected,
    mappingsReady,
    workersConnected,
    cloudflareConnected,
    ready
  };
}

