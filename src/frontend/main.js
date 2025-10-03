async function fetchJSON(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function refreshShops() {
  const shops = await fetchJSON('/api/onboarding/shops');
  document.getElementById('shop-list').textContent = JSON.stringify(shops, null, 2);
}

function renderMappingOptions(mappings) {
  const select = document.getElementById('testMapping');
  select.innerHTML = '<option value="">Selecione um mapeamento</option>';
  mappings.forEach((mapping) => {
    const option = document.createElement('option');
    const origin = mapping.siteAShopDomain || 'origem?';
    const target = mapping.siteBShopDomain || 'destino?';
    option.value = mapping.id;
    option.textContent = `${mapping.id} (${origin} → ${target})`;
    select.appendChild(option);
  });
  select.disabled = mappings.length === 0;
}

async function refreshMappings() {
  const mappings = await fetchJSON('/api/onboarding/mappings');
  document.getElementById('mapping-list').textContent = JSON.stringify(mappings, null, 2);
  renderMappingOptions(mappings);
}

async function refreshEdgeWorkers() {
  const workers = await fetchJSON('/api/onboarding/edge-workers');
  document.getElementById('edge-worker-list').textContent = JSON.stringify(workers, null, 2);
}

const metricLabels = {
  initiated: 'Sessões registradas',
  redirectReady: 'Checkout pronto',
  paid: 'Pedidos pagos',
  failed: 'Falhas'
};

function renderMetrics(totals, edgeWorkersConnected) {
  const metricsContainer = document.getElementById('metrics');
  metricsContainer.innerHTML = Object.entries(totals)
    .map(
      ([key, value]) => `
        <div class="metric-card">
          <strong>${value}</strong>
          <div>${metricLabels[key] || key}</div>
        </div>
      `
    )
    .join('');
  metricsContainer.insertAdjacentHTML(
    'beforeend',
    `
      <div class="metric-card">
        <strong>${edgeWorkersConnected}</strong>
        <div>Servidores Jump AB</div>
      </div>
    `
  );
}

async function refreshDashboard() {
  const { totals, edgeWorkersConnected } = await fetchJSON('/api/dashboard/metrics');
  renderMetrics(totals, edgeWorkersConnected);
  const events = await fetchJSON('/api/dashboard/events');
  document.getElementById('events').textContent = JSON.stringify(events, null, 2);
}

async function refreshStatus() {
  const status = await fetchJSON('/api/onboarding/status');
  const container = document.getElementById('status-summary');
  container.innerHTML = `
    <ul>
      <li>Lojas origem conectadas: <strong>${status.siteAConnected ? 'Sim' : 'Não'}</strong></li>
      <li>Lojas destino conectadas: <strong>${status.siteBConnected ? 'Sim' : 'Não'}</strong></li>
      <li>Mapeamentos prontos: <strong>${status.mappingsReady ? 'Sim' : 'Não'}</strong></li>
      <li>Servidores Jump AB: <strong>${status.workersConnected}</strong></li>
    </ul>
  `;
  const button = document.getElementById('generate-test-link');
  button.disabled = !status.ready;
  const helper = document.getElementById('test-link-helper');
  helper.textContent = status.ready
    ? 'Selecione um mapeamento e gere um link de checkout para validar o fluxo.'
    : 'Conecte ao menos uma loja de origem, uma de destino e crie um mapeamento ativo para liberar o link de teste.';
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
    await refreshStatus();
    event.target.reset();
  });

  document.getElementById('mapping-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      id: document.getElementById('mappingId').value,
      channel: document.getElementById('channel').value || undefined,
      siteAProductId: document.getElementById('productA').value,
      siteBProductId: document.getElementById('variantB').value,
      siteBVariantId: document.getElementById('variantB').value,
      siteAShopDomain: document.getElementById('shopA').value,
      siteBShopDomain: document.getElementById('shopB').value
    };
    await fetchJSON('/api/onboarding/mappings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshMappings();
    await refreshStatus();
    event.target.reset();
  });

  document.getElementById('edge-worker-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      id: document.getElementById('edgeWorkerId').value,
      label: document.getElementById('edgeWorkerLabel').value || undefined,
      endpointUrl: document.getElementById('edgeWorkerUrl').value,
      regions: document.getElementById('edgeWorkerRegions').value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    };
    await fetchJSON('/api/onboarding/edge-workers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await refreshEdgeWorkers();
    await refreshStatus();
    event.target.reset();
  });

  document.getElementById('generate-test-link').addEventListener('click', async () => {
    const mappingSelect = document.getElementById('testMapping');
    const mappingId = mappingSelect.value;
    if (!mappingId) {
      alert('Selecione um mapeamento válido.');
      return;
    }
    try {
      const result = await fetchJSON('/api/onboarding/test-link', {
        method: 'POST',
        body: JSON.stringify({ mappingId })
      });
      document.getElementById('test-link-output').innerHTML = `
        <p>Link gerado com sucesso!</p>
        ${result.originShop ? `<p>Origem: <strong>${result.originShop}</strong></p>` : ''}
        ${result.targetShop ? `<p>Destino: <strong>${result.targetShop}</strong></p>` : ''}
        ${result.edgeWorker ? `<p>Servidor: <strong>${result.edgeWorker.label || result.edgeWorker.id}</strong></p>` : ''}
        <a href="${result.checkoutUrl}" target="_blank" rel="noopener">Abrir checkout de teste</a>
      `;
      await refreshDashboard();
    } catch (error) {
      document.getElementById('test-link-output').textContent = error.message;
    }
  });

  document.getElementById('edge-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      product_x_id: document.getElementById('edgeProduct').value,
      channel: document.getElementById('edgeChannel').value || undefined,
      quantity: Number(document.getElementById('edgeQuantity').value || '1')
    };
    try {
      const result = await fetchJSON('/api/edge/intercept', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      document.getElementById('edge-result').innerHTML = `
        <p>Status: <strong>${result.status}</strong></p>
        ${result.originShop ? `<p>Origem: ${result.originShop}</p>` : ''}
        ${result.targetShop ? `<p>Destino: ${result.targetShop}</p>` : ''}
        ${result.edgeWorker ? `<p>Servidor: ${result.edgeWorker.label || result.edgeWorker.id}</p>` : ''}
        ${result.checkoutUrl ? `<a href="${result.checkoutUrl}" target="_blank" rel="noopener">Abrir checkout seguro</a>` : ''}
      `;
    } catch (error) {
      document.getElementById('edge-result').textContent = error.message;
    }
    await refreshDashboard();
  });

  await refreshShops();
  await refreshMappings();
  await refreshEdgeWorkers();
  await refreshStatus();
  await refreshDashboard();
}

init().catch((error) => {
  console.error(error);
  alert('Erro ao inicializar o protótipo. Verifique o console.');
});
