import { randomUUID } from 'crypto';
import { getConfig, pushEvent, recordSession } from '../lib/storage.js';
import { createShopifyCheckout } from './shopifyService.js';

export async function decideRouting(requestPayload) {
  const config = await getConfig();
  const mapping = config.productMappings.find(
    (entry) =>
      entry.siteAProductId === requestPayload.product_x_id &&
      (!entry.channel || entry.channel === requestPayload.channel)
  );

  if (!mapping) {
    await pushEvent({
      type: 'routing.skipped',
      reason: 'mapping_not_found',
      sessionId: requestPayload.session_id_a,
      product: requestPayload.product_x_id
    });
    return { status: 'unmapped' };
  }

  const originShop = config.shops.siteA.find((shop) => shop.shopDomain === mapping.siteAShopDomain);
  if (!originShop) {
    await pushEvent({
      type: 'routing.skipped',
      reason: 'origin_shop_missing',
      sessionId: requestPayload.session_id_a,
      product: requestPayload.product_x_id
    });
    return { status: 'origin_missing' };
  }

  const sessionId = requestPayload.session_id_a ?? randomUUID();

  const shopTarget = config.shops.siteB.find((shop) => shop.shopDomain === mapping.siteBShopDomain);

  if (!shopTarget) {
    await pushEvent({
      type: 'routing.skipped',
      reason: 'target_shop_missing',
      sessionId,
      product: requestPayload.product_x_id
    });
    return { status: 'target_missing' };
  }

  const edgeWorker = config.edgeWorkers[0] ?? null;
  const checkout = await createShopifyCheckout({
    shopDomain: shopTarget.shopDomain,
    accessToken: shopTarget.adminAccessToken,
    mapping,
    quantity: requestPayload.quantity ?? 1,
    customerHint: requestPayload.customer_hint,
    sessionId
  });

  await recordSession(sessionId, {
    product_x_id: requestPayload.product_x_id,
    targetShop: shopTarget.shopDomain,
    originShop: originShop.shopDomain,
    checkoutId: checkout.checkoutId,
    edgeWorkerId: edgeWorker?.id ?? null,
    status: 'redirect_ready'
  });

  await pushEvent({
    type: 'routing.decision',
    sessionId,
    mappingId: mapping.id,
    originShop: originShop.shopDomain,
    targetShop: shopTarget.shopDomain,
    edgeWorkerId: edgeWorker?.id ?? null,
    checkoutId: checkout.checkoutId
  });

  return {
    status: 'ready',
    sessionId,
    checkoutUrl: checkout.checkoutUrl,
    checkoutId: checkout.checkoutId,
    targetShop: shopTarget.shopDomain,
    originShop: originShop.shopDomain,
    edgeWorker: edgeWorker ? { id: edgeWorker.id, label: edgeWorker.label } : null
  };
}

export async function generateTestCheckoutLink(mappingId) {
  const config = await getConfig();
  const mapping = config.productMappings.find((entry) => entry.id === mappingId);

  if (!mapping) {
    throw new Error('Mapeamento não encontrado');
  }

  const sessionId = `test-${randomUUID()}`;
  const decision = await decideRouting({
    product_x_id: mapping.siteAProductId,
    channel: mapping.channel,
    session_id_a: sessionId,
    quantity: 1
  });

  if (decision.status !== 'ready') {
    throw new Error(`Não foi possível gerar link de teste (${decision.status})`);
  }

  await pushEvent({
    type: 'onboarding.test_link.generated',
    sessionId: decision.sessionId,
    mappingId,
    checkoutId: decision.checkoutId
  });

  return decision;
}
