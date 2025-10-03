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

export async function listPolicies() {
  const config = await getConfig();
  return config.routingPolicies;
}

export async function savePolicy(policy) {
  await updateConfig((config) => {
    upsert(config.routingPolicies, policy, 'id');
  });
}

export async function deletePolicy(id) {
  await updateConfig((config) => {
    const index = config.routingPolicies.findIndex((p) => p.id === id);
    if (index >= 0) {
      config.routingPolicies.splice(index, 1);
    }
  });
}

export async function getConsentCopy() {
  const config = await getConfig();
  return config.consent;
}

export async function saveConsentCopy(consent) {
  await updateConfig((config) => {
    config.consent = { ...config.consent, ...consent };
  });
}
