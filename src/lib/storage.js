import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { constants } from 'fs';
import { resolve, dirname } from 'path';
import { defaultConfig } from '../config/defaultConfig.js';

const DATA_PATH = resolve(process.env.CONFIG_PATH ?? './data/config.json');

async function ensureConfigFile() {
  try {
    await access(DATA_PATH, constants.F_OK);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await mkdir(dirname(DATA_PATH), { recursive: true });
      await writeFile(DATA_PATH, JSON.stringify(defaultConfig, null, 2));
    } else {
      throw error;
    }
  }
}

async function loadConfig() {
  await ensureConfigFile();
  const raw = await readFile(DATA_PATH, 'utf-8');
  return JSON.parse(raw);
}

async function saveConfig(config) {
  await mkdir(dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(config, null, 2));
}

async function withConfig(mutator) {
  const config = await loadConfig();
  const result = await mutator(config);
  if (result?.skipSave) {
    return result?.value;
  }
  await saveConfig(config);
  return result?.value ?? config;
}

export async function getConfig() {
  return loadConfig();
}

export async function updateConfig(updater) {
  return withConfig(async (config) => {
    const updated = await updater(config);
    if (updated !== undefined) {
      return { value: updated };
    }
  });
}

export async function pushEvent(event) {
  const timestamp = new Date().toISOString();
  await updateConfig((config) => {
    config.events.push({ timestamp, ...event });
  });
}

export async function recordSession(sessionId, data) {
  await updateConfig((config) => {
    config.sessions[sessionId] = {
      ...(config.sessions[sessionId] ?? {}),
      ...data,
      updatedAt: new Date().toISOString()
    };
  });
}

export async function getSessions() {
  const config = await getConfig();
  return config.sessions;
}

export async function getEvents(limit = 50) {
  const config = await getConfig();
  return config.events.slice(-limit).reverse();
}
