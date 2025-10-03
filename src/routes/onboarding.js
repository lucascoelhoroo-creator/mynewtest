import { Router } from 'express';
import {
  connectShop,
  deleteProductMapping,
  deleteEdgeWorker,
  getOnboardingStatus,
  listProductMappings,
  listShops,
  listEdgeWorkers,
  saveEdgeWorker,
  saveProductMapping
} from '../services/configService.js';
import { generateTestCheckoutLink } from '../services/routingService.js';
import {
  connectCloudflareAccount,
  getCloudflareAccount
} from '../services/cloudflareService.js';

const router = Router();

router.get('/shops', async (_req, res) => {
  const shops = await listShops();
  res.json(shops);
});

router.post('/shops', async (req, res) => {
  const { shopDomain, adminAccessToken, role } = req.body;
  if (!shopDomain || !role) {
    return res.status(400).json({ message: 'shopDomain and role are required' });
  }
  await connectShop({ shopDomain, adminAccessToken, role });
  res.status(201).json({ message: 'Shop connected' });
});

router.get('/mappings', async (_req, res) => {
  const mappings = await listProductMappings();
  res.json(mappings);
});

router.post('/mappings', async (req, res) => {
  const mapping = req.body;
  if (!mapping.id) {
    return res.status(400).json({ message: 'Mapping id is required' });
  }
  await saveProductMapping(mapping);
  res.status(201).json({ message: 'Mapping saved' });
});

router.delete('/mappings/:id', async (req, res) => {
  await deleteProductMapping(req.params.id);
  res.status(204).send();
});

router.get('/edge-workers', async (_req, res) => {
  const workers = await listEdgeWorkers();
  res.json(workers);
});

router.post('/edge-workers', async (req, res) => {
  const worker = req.body;
  if (!worker.id || !worker.endpointUrl) {
    return res.status(400).json({ message: 'Edge worker id and endpointUrl are required' });
  }
  await saveEdgeWorker(worker);
  res.status(201).json({ message: 'Edge worker saved' });
});

router.delete('/edge-workers/:id', async (req, res) => {
  await deleteEdgeWorker(req.params.id);
  res.status(204).send();
});

router.get('/status', async (_req, res) => {
  const status = await getOnboardingStatus();
  res.json(status);
});

router.post('/test-link', async (req, res) => {
  try {
    const { mappingId } = req.body;
    if (!mappingId) {
      return res.status(400).json({ message: 'mappingId is required' });
    }
    const decision = await generateTestCheckoutLink(mappingId);
    res.status(201).json({
      message: 'Link de teste gerado',
      checkoutUrl: decision.checkoutUrl,
      sessionId: decision.sessionId,
      targetShop: decision.targetShop,
      originShop: decision.originShop,
      edgeWorker: decision.edgeWorker
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/cloudflare', async (_req, res) => {
  const account = await getCloudflareAccount();
  res.json(account);
});

router.post('/cloudflare/connect', async (req, res) => {
  try {
    const { accountId, apiToken } = req.body;
    const result = await connectCloudflareAccount({ accountId, apiToken });
    res.status(200).json({
      message: 'Conta Cloudflare conectada e workers sincronizados',
      ...result
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
