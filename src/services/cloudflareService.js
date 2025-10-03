import { getConfig, updateConfig } from '../lib/storage.js';

let runtimeFetch = globalThis.fetch;

async function callFetch(...args) {
  if (!runtimeFetch) {
    const module = await import('node-fetch');
    runtimeFetch = module.default;
  }
  return runtimeFetch(...args);
}

async function fetchJson(url, options = {}) {
  const response = await callFetch(url, options);
  const body = await response.json();
  if (!body.success) {
    const message = body.errors?.map((error) => error.message).join('; ') || 'Cloudflare API error';
    const error = new Error(message);
    error.response = body;
    throw error;
  }
  return body.result;
}

function buildHeaders(apiToken) {
  return {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json'
  };
}

export async function verifyCloudflareToken(apiToken) {
  const result = await fetchJson('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    method: 'GET',
    headers: buildHeaders(apiToken)
  });
  return result;
}

export async function fetchCloudflareSubdomain(accountId, apiToken) {
  const result = await fetchJson(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
    {
      method: 'GET',
      headers: buildHeaders(apiToken)
    }
  );
  return result?.subdomain ?? null;
}

export async function fetchCloudflareWorkers(accountId, apiToken) {
  const result = await fetchJson(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
    {
      method: 'GET',
      headers: buildHeaders(apiToken)
    }
  );
  return Array.isArray(result) ? result : [];
}

function upsert(list, item, key = 'id') {
  const index = list.findIndex((entry) => entry[key] === item[key]);
  if (index >= 0) {
    list[index] = { ...list[index], ...item };
  } else {
    list.push(item);
  }
}

export async function connectCloudflareAccount({ accountId, apiToken }) {
  if (!accountId || !apiToken) {
    throw new Error('accountId e apiToken são obrigatórios');
  }

  await verifyCloudflareToken(apiToken);
  const subdomain = await fetchCloudflareSubdomain(accountId, apiToken);
  const scripts = await fetchCloudflareWorkers(accountId, apiToken);
  const syncedAt = new Date().toISOString();

  const workers = scripts.map((script) => ({
    id: script.id,
    label: script.name ?? script.id,
    endpointUrl: subdomain ? `https://${script.id}.${subdomain}.workers.dev` : null,
    regions: script.migration_tag ? [script.migration_tag] : []
  }));

  await updateConfig((config) => {
    config.cloudflareAccount = {
      accountId,
      subdomain,
      workerCount: workers.length,
      lastSyncedAt: syncedAt
    };
    workers
      .filter((worker) => worker.endpointUrl)
      .forEach((worker) => {
        upsert(config.edgeWorkers, worker, 'id');
      });
  });

  return { accountId, subdomain, workerCount: workers.length, workers, syncedAt };
}

export async function getCloudflareAccount() {
  const config = await getConfig();
  if (!config.cloudflareAccount) {
    return { connected: false };
  }

  return {
    connected: true,
    ...config.cloudflareAccount
  };
}
