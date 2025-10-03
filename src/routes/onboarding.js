import { Router } from 'express';
import {
  connectShop,
  deletePolicy,
  deleteProductMapping,
  getConsentCopy,
  listPolicies,
  listProductMappings,
  listShops,
  saveConsentCopy,
  savePolicy,
  saveProductMapping
} from '../services/configService.js';

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

router.get('/policies', async (_req, res) => {
  const policies = await listPolicies();
  res.json(policies);
});

router.post('/policies', async (req, res) => {
  const policy = req.body;
  if (!policy.id) {
    return res.status(400).json({ message: 'Policy id is required' });
  }
  await savePolicy(policy);
  res.status(201).json({ message: 'Policy saved' });
});

router.delete('/policies/:id', async (req, res) => {
  await deletePolicy(req.params.id);
  res.status(204).send();
});

router.get('/consent', async (_req, res) => {
  const consent = await getConsentCopy();
  res.json(consent);
});

router.post('/consent', async (req, res) => {
  await saveConsentCopy(req.body);
  res.status(200).json({ message: 'Consent updated' });
});

export default router;
