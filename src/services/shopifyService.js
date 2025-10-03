import { pushEvent } from '../lib/storage.js';

let runtimeFetch = globalThis.fetch;

async function callFetch(...args) {
  if (!runtimeFetch) {
    const module = await import('node-fetch');
    runtimeFetch = module.default;
  }
  return runtimeFetch(...args);
}

const CHECKOUT_MUTATION = `#graphql
mutation CreateCheckout($input: CheckoutCreateInput!) {
  checkoutCreate(input: $input) {
    checkout {
      id
      webUrl
    }
    checkoutUserErrors {
      field
      message
    }
  }
}
`;

export async function createShopifyCheckout({
  shopDomain,
  accessToken,
  mapping,
  quantity,
  customerHint,
  sessionId
}) {
  // Prototype: we simulate API call if token is missing to avoid sensitive handling.
  if (!accessToken) {
    const fakeId = `gid://shopify/Checkout/${sessionId}`;
    const fakeUrl = `https://${shopDomain}/checkout/${sessionId}`;
    await pushEvent({
      type: 'shopify.checkout.simulated',
      shopDomain,
      checkoutId: fakeId,
      checkoutUrl: fakeUrl
    });
    return { checkoutId: fakeId, checkoutUrl: fakeUrl };
  }

  const endpoint = `https://${shopDomain}/admin/api/2024-04/graphql.json`;
  const response = await callFetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({
      query: CHECKOUT_MUTATION,
      variables: {
        input: {
          lineItems: [
            {
              quantity,
              variantId: mapping.siteBVariantId ?? mapping.siteBProductId
            }
          ],
          customAttributes: [
            { key: 'ab_jump_session_id', value: sessionId },
            { key: 'source_site', value: mapping.siteAShopDomain }
          ],
          email: customerHint?.email ?? undefined
        }
      }
    })
  });

  const body = await response.json();
  const errors = body.data?.checkoutCreate?.checkoutUserErrors;
  if (errors?.length) {
    await pushEvent({
      type: 'shopify.checkout.error',
      shopDomain,
      errors,
      sessionId
    });
    throw new Error(`Shopify checkout error: ${errors.map((e) => e.message).join(', ')}`);
  }

  const checkout = body.data?.checkoutCreate?.checkout;
  await pushEvent({
    type: 'shopify.checkout.created',
    shopDomain,
    checkoutId: checkout.id,
    checkoutUrl: checkout.webUrl,
    sessionId
  });
  return { checkoutId: checkout.id, checkoutUrl: checkout.webUrl };
}
