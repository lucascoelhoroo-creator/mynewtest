async function fetchJSON(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  return response.json();
}

function parseCsv(input) {
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function refreshShops() {
  const container = document.getElementById('shop-list');
  const shops = await fetchJSON('/api/onboarding/shops');
  container.textContent = JSON.stringify(shops, null, 2);
}

async function refreshMappings() {
  const container = document.getElementById('mapping-list');
  const mappings = await fetchJSON('/api/onboarding/mappings');
  container.textContent = JSON.stringify(mappings, null, 2);
}

async function refreshPolicies() {
  const container = document.getElementById('policy-list');
  const policies = await fetchJSON('/api/onboarding/policies');
  container.textContent = JSON.stringify(policies, null, 2);
}

async function refreshConsent() {
  const consent = await fetchJSON('/api/onboarding/consent');
  document.getElementById('consentMessage').value = consent.message || '';
  document.getElementById('ctaProceed').value = consent.ctaProceed || '';
  document.getElementById('ctaCancel').value = consent.ctaCancel || '';
  document.getElementById('consentEnabled').checked = consent.enabled !== false;
}

async function refreshDashboard() {
  const metricsContainer = document.getElementById('metrics');
  const eventsContainer = document.getElementById('events');
  const { totals, consentCopyConfigured } = await fetchJSON('/api/dashboard/metrics');
  metricsContainer.innerHTML = Object.entries(totals)
    .map(
      ([key, value]) => `
        <div class="metric-card">
          <strong>${value}</strong>
          <div>${key}</div>
        </div>
      `
    )
    .join('');
  metricsContainer.insertAdjacentHTML(
    'beforeend',
    `
      <div class="metric-card">
        <strong>${consentCopyConfigured ? 'OK' : 'Pendente'}</strong>
        <div>Consentimento Configurado</div>
      </div>
    `
  );
  const events = await fetchJSON('/api/dashboard/events');
  eventsContainer.textContent = JSON.stringify(events, null, 2);
}

async function init() {
  document.getElementById('shop-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const role = document.getElementById('role').value;
    const shopDomain = document.getElementById('shopDomain').value;
    const adminAccessToken = document.getElementById('adminAccessToken').value || undefined;
    await fetchJSON('/api/onboarding/shops', {
      method: 'POST',
      body: JSON.stringify({ role, shopDomain, adminAccessToken })
    });
    await refreshShops();
    event.target.reset();
  });

  document.getElementById('mapping-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      id: document.getElementById('mappingId').value,
      channel: document.getElementById('channel').value || undefined,
      siteAProductId: document.getElementById('productA').value,
      siteBProductId: document.getElementById('variantB').value,
      siteAShopDomain: document.getElementById('shopA').value,
      siteBShopDomain: document.getElementById('shopB').value
    };
    await fetchJSON('/api/onboarding/mappings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshMappings();
    event.target.reset();
  });

  document.getElementById('policy-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      id: document.getElementById('policyId').value,
      enabled: document.getElementById('policyEnabled').checked,
      criteria: {
        regions: parseCsv(document.getElementById('regions').value),
        languages: parseCsv(document.getElementById('languages').value),
        channels: parseCsv(document.getElementById('channels').value)
      }
    };
    await fetchJSON('/api/onboarding/policies', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshPolicies();
    event.target.reset();
  });

  document.getElementById('consent-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      message: document.getElementById('consentMessage').value,
      ctaProceed: document.getElementById('ctaProceed').value,
      ctaCancel: document.getElementById('ctaCancel').value,
      enabled: document.getElementById('consentEnabled').checked
    };
    await fetchJSON('/api/onboarding/consent', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshConsent();
  });

  document.getElementById('edge-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      product_x_id: document.getElementById('edgeProduct').value,
      region: document.getElementById('edgeRegion').value,
      language: document.getElementById('edgeLanguage').value,
      channel: document.getElementById('edgeChannel').value
    };
    try {
      const result = await fetchJSON('/api/edge/intercept', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      document.getElementById('edge-result').innerHTML = `
        <p>Status: <strong>${result.status}</strong></p>
        ${result.consent ? `<p>${result.consent.message}</p>` : ''}
        ${result.checkoutUrl ? `<a href="${result.checkoutUrl}" target="_blank">Abrir checkout seguro</a>` : ''}
      `;
    } catch (error) {
      document.getElementById('edge-result').textContent = error.message;
    }
    await refreshDashboard();
  });

  await refreshShops();
  await refreshMappings();
  await refreshPolicies();
  await refreshConsent();
  await refreshDashboard();
}

init().catch((error) => {
  console.error(error);
  alert('Erro ao inicializar o protótipo. Verifique o console.');
});
