import { randomUUID } from 'crypto';
import {
  getConfig,
  pushEvent,
  recordSession
} from '../lib/storage.js';
import { createShopifyCheckout } from './shopifyService.js';

function matchPolicies(policies, context) {
  return policies
    .filter((policy) => policy.enabled !== false)
    .filter((policy) => {
      if (policy.criteria?.regions?.length) {
        if (!context.region || !policy.criteria.regions.includes(context.region)) {
          return false;
        }
      }
      if (policy.criteria?.languages?.length) {
        if (!context.language || !policy.criteria.languages.includes(context.language)) {
          return false;
        }
      }
      if (policy.criteria?.channels?.length) {
        if (!context.channel || !policy.criteria.channels.includes(context.channel)) {
          return false;
        }
      }
      return true;
    });
}

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

  const policies = matchPolicies(config.routingPolicies, requestPayload);
  const policy = policies[0];

  if (!policy) {
    await pushEvent({
      type: 'routing.skipped',
      reason: 'policy_not_matched',
      sessionId: requestPayload.session_id_a,
      product: requestPayload.product_x_id
    });
    return { status: 'policy_not_matched' };
  }

  const sessionId = requestPayload.session_id_a ?? randomUUID();
  const consentCopy = config.consent;
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
    checkoutId: checkout.checkoutId,
    policyId: policy.id,
    status: 'awaiting_consent'
  });

  await pushEvent({
    type: 'routing.decision',
    sessionId,
    policyId: policy.id,
    targetShop: shopTarget.shopDomain,
    checkoutId: checkout.checkoutId
  });

  return {
    status: 'ready',
    sessionId,
    consent: consentCopy,
    checkoutUrl: checkout.checkoutUrl,
    checkoutId: checkout.checkoutId,
    targetShop: shopTarget.shopDomain
  };
}
