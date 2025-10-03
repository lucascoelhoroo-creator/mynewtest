const config = window.AB_JUMP_CONFIG ?? {};

function normaliseBase(value) {
  if (!value) return '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value);
}

function buildUrl(path, base) {
  if (isAbsoluteUrl(path)) {
    return path;
  }
  const normalised = path.startsWith('/') ? path : `/${path}`;
  if (!base) {
    return normalised;
  }
  return `${base}${normalised}`;
}

const API_BASE = normaliseBase(config.apiBase || '');
const EDGE_PROXY_BASE = normaliseBase(config.edgeProxyBase || '');

function shouldSkipHealthCheck(endpoint, usingRemoteWorker) {
  if (usingRemoteWorker) {
    return true;
  }
  if (!isAbsoluteUrl(endpoint)) {
    return false;
  }
  const reference = API_BASE || window.location.origin;
  if (!reference) {
    return false;
  }
  return !endpoint.startsWith(reference);
}

const state = {
  backendHealthy: null,
  hideBannerTimeout: null
};

const connectivityBanner = document.getElementById('connectivity-banner');
if (connectivityBanner) {
  connectivityBanner.hidden = false;
  connectivityBanner.classList.remove('banner-success', 'banner-error');
  connectivityBanner.classList.add('banner-info');
  connectivityBanner.textContent = 'Validando conexão com o backend...';
}

function setBackendHealth(isHealthy, message = '') {
  if (!connectivityBanner) {
    return;
  }

  if (isHealthy) {
    if (state.backendHealthy === true && !connectivityBanner.classList.contains('banner-error')) {
      return;
    }
    state.backendHealthy = true;
    connectivityBanner.hidden = false;
    connectivityBanner.classList.remove('banner-info', 'banner-error');
    connectivityBanner.classList.add('banner-success');
    connectivityBanner.textContent = message || 'Conectado ao backend.';
    if (state.hideBannerTimeout) {
      clearTimeout(state.hideBannerTimeout);
    }
    state.hideBannerTimeout = setTimeout(() => {
      connectivityBanner.hidden = true;
    }, 2200);
    return;
  }

  state.backendHealthy = false;
  connectivityBanner.hidden = false;
  connectivityBanner.classList.remove('banner-info', 'banner-success');
  connectivityBanner.classList.add('banner-error');
  connectivityBanner.textContent = message || 'Não foi possível contatar o backend.';
  if (state.hideBannerTimeout) {
    clearTimeout(state.hideBannerTimeout);
    state.hideBannerTimeout = null;
  }
}

function showFeedback(elementId, message, tone = 'info') {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }
  element.classList.remove('feedback-info', 'feedback-success', 'feedback-error');
  if (!message) {
    element.textContent = '';
    element.hidden = true;
    return;
  }
  element.hidden = false;
  element.textContent = message;
  element.classList.add(`feedback-${tone}`);
}

async function fetchJSON(path, options = {}) {
  const { skipHealthUpdate, ...rest } = options;
  const targetUrl = buildUrl(path, API_BASE);
  const init = {
    ...rest,
    headers: new Headers(rest.headers ?? {})
  };

  if (init.mode === undefined) {
    delete init.mode;
  }

  if (!init.headers.has('Accept')) {
    init.headers.set('Accept', 'application/json');
  }

  if (init.body && !init.headers.has('Content-Type')) {
    init.headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(targetUrl, init);
    const contentType = response.headers.get('content-type') ?? '';
    let bodyText = '';

    if (response.status !== 204) {
      bodyText = await response.text();
    }

    let jsonBody = null;
    if (bodyText && contentType.includes('application/json')) {
      try {
        jsonBody = JSON.parse(bodyText);
      } catch (error) {
        jsonBody = null;
      }
    }

    if (!response.ok) {
      const message =
        jsonBody?.message ||
        jsonBody?.error ||
        (typeof bodyText === 'string' && bodyText.trim() ? bodyText : response.statusText || 'Request failed');
      throw new Error(message);
    }

    if (!skipHealthUpdate) {
      setBackendHealth(true);
    }

    if (response.status === 204) {
      return null;
    }

    return jsonBody ?? bodyText ?? null;
  } catch (error) {
    if (!skipHealthUpdate) {
      setBackendHealth(false, error.message);
    }
    throw error;
  }
}

let cachedEdgeWorkers = [];

function renderMappingOptions(mappings) {
  const select = document.getElementById('testMapping');
  if (!select) {
    return;
  }
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

async function refreshShops() {
  const output = document.getElementById('shop-list');
  if (!output) {
    return;
  }
  try {
    const shops = await fetchJSON('/api/onboarding/shops');
    output.textContent = JSON.stringify(shops, null, 2);
  } catch (error) {
    output.textContent = `Erro ao carregar lojas: ${error.message}`;
  }
}

async function refreshMappings() {
  const output = document.getElementById('mapping-list');
  if (!output) {
    return;
  }
  try {
    const mappings = await fetchJSON('/api/onboarding/mappings');
    output.textContent = JSON.stringify(mappings, null, 2);
    renderMappingOptions(mappings);
  } catch (error) {
    output.textContent = `Erro ao carregar mapeamentos: ${error.message}`;
    renderMappingOptions([]);
  }
}

function updateEdgeWorkerSelect(workers) {
  const select = document.getElementById('edgeWorkerSelect');
  if (!select) {
    return;
  }

  const previousValue = select.value;
  select.innerHTML = '';

  const localOption = document.createElement('option');
  localOption.value = 'local';
  localOption.textContent = 'Servidor local (Express)';
  select.appendChild(localOption);

  workers.forEach((worker) => {
    const option = document.createElement('option');
    option.value = worker.id;
    const label = worker.label ? `${worker.label} (${worker.id})` : worker.id;
    option.textContent = label;
    select.appendChild(option);
  });

  if (workers.some((worker) => worker.id === previousValue)) {
    select.value = previousValue;
  }
}

async function refreshEdgeWorkers() {
  const output = document.getElementById('edge-worker-list');
  if (!output) {
    return;
  }
  try {
    const workers = await fetchJSON('/api/onboarding/edge-workers');
    cachedEdgeWorkers = workers;
    output.textContent = JSON.stringify(workers, null, 2);
    updateEdgeWorkerSelect(workers);
  } catch (error) {
    cachedEdgeWorkers = [];
    output.textContent = `Erro ao carregar servidores: ${error.message}`;
    updateEdgeWorkerSelect([]);
  }
}

async function refreshCloudflareStatus() {
  const container = document.getElementById('cloudflare-status');
  if (!container) {
    return;
  }
  try {
    const status = await fetchJSON('/api/onboarding/cloudflare');
    if (!status.connected) {
      container.innerHTML = '<p>Nenhuma conta Cloudflare conectada. Informe as credenciais para sincronizar automaticamente seus workers.</p>';
      return;
    }
    container.innerHTML = `
      <p><strong>Conta conectada:</strong> ${status.accountId}</p>
      ${status.subdomain ? `<p><strong>Subdomínio:</strong> ${status.subdomain}.workers.dev</p>` : ''}
      <p><strong>Workers sincronizados:</strong> ${status.workerCount ?? 0}</p>
      ${status.lastSyncedAt ? `<p><small>Última sincronização: ${new Date(status.lastSyncedAt).toLocaleString()}</small></p>` : ''}
    `;
  } catch (error) {
    container.textContent = `Falha ao carregar status da Cloudflare: ${error.message}`;
  }
}

const metricLabels = {
  initiated: 'Sessões registradas',
  redirectReady: 'Checkout pronto',
  paid: 'Pedidos pagos',
  failed: 'Falhas'
};

function renderMetrics(totals = {}, edgeWorkersConnected = 0) {
  const metricsContainer = document.getElementById('metrics');
  if (!metricsContainer) {
    return;
  }
  const entries = Object.entries(totals);
  if (!entries.length) {
    metricsContainer.innerHTML = `
      <div class="metric-card">
        <strong>0</strong>
        <div>Sessões registradas</div>
      </div>
      <div class="metric-card">
        <strong>0</strong>
        <div>Checkout pronto</div>
      </div>
      <div class="metric-card">
        <strong>0</strong>
        <div>Pedidos pagos</div>
      </div>
      <div class="metric-card">
        <strong>0</strong>
        <div>Falhas</div>
      </div>
      <div class="metric-card">
        <strong>${edgeWorkersConnected}</strong>
        <div>Servidores Jump AB</div>
      </div>
    `;
    return;
  }

  metricsContainer.innerHTML = entries
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
  try {
    const { totals = {}, edgeWorkersConnected = 0 } = await fetchJSON('/api/dashboard/metrics');
    renderMetrics(totals, edgeWorkersConnected);
  } catch (error) {
    renderMetrics({}, 0);
  }

  const eventsOutput = document.getElementById('events');
  if (!eventsOutput) {
    return;
  }
  try {
    const events = await fetchJSON('/api/dashboard/events');
    eventsOutput.textContent = JSON.stringify(events, null, 2);
  } catch (error) {
    eventsOutput.textContent = `Erro ao carregar eventos: ${error.message}`;
  }
}

async function refreshStatus() {
  const container = document.getElementById('status-summary');
  const helper = document.getElementById('test-link-helper');
  const button = document.getElementById('generate-test-link');
  if (!container || !helper || !button) {
    return;
  }
  try {
    const status = await fetchJSON('/api/onboarding/status');
    container.innerHTML = `
      <ul>
        <li>Lojas origem conectadas: <strong>${status.siteAConnected ? 'Sim' : 'Não'}</strong></li>
        <li>Lojas destino conectadas: <strong>${status.siteBConnected ? 'Sim' : 'Não'}</strong></li>
        <li>Mapeamentos prontos: <strong>${status.mappingsReady ? 'Sim' : 'Não'}</strong></li>
        <li>Servidores Jump AB: <strong>${status.workerCount ?? 0}</strong></li>
        <li>Conta Cloudflare: <strong>${status.cloudflareConnected ? 'Sincronizada' : 'Pendente'}</strong></li>
      </ul>
    `;
    button.disabled = !status.ready;
    helper.textContent = status.ready
      ? 'Selecione um mapeamento e gere um link de checkout para validar o fluxo.'
      : 'Conecte ao menos uma loja de origem, uma de destino e crie um mapeamento ativo para liberar o link de teste.';
  } catch (error) {
    container.textContent = `Não foi possível carregar o status: ${error.message}`;
    button.disabled = true;
    helper.textContent = 'Verifique a conexão com o backend antes de gerar o link de teste.';
  }
}

function buildLocalEdgeEndpoint() {
  if (EDGE_PROXY_BASE) {
    return `${EDGE_PROXY_BASE}/api/edge/intercept`;
  }
  return '/api/edge/intercept';
}

async function init() {
  const shopForm = document.getElementById('shop-form');
  if (shopForm) {
    shopForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      showFeedback('shop-feedback', 'Salvando loja...', 'info');
      const payload = {
        role: document.getElementById('role').value,
        shopDomain: document.getElementById('shopDomain').value,
        adminAccessToken: document.getElementById('adminAccessToken').value || undefined
      };

      try {
        await fetchJSON('/api/onboarding/shops', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showFeedback('shop-feedback', 'Loja salva com sucesso.', 'success');
        shopForm.reset();
      } catch (error) {
        showFeedback('shop-feedback', `Falha ao salvar loja: ${error.message}`, 'error');
      }

      await refreshShops();
      await refreshStatus();
    });
  }

  const mappingForm = document.getElementById('mapping-form');
  if (mappingForm) {
    mappingForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      showFeedback('mapping-feedback', 'Salvando mapeamento...', 'info');
      const payload = {
        id: document.getElementById('mappingId').value,
        channel: document.getElementById('channel').value || undefined,
        siteAProductId: document.getElementById('productA').value,
        siteBProductId: document.getElementById('variantB').value,
        siteBVariantId: document.getElementById('variantB').value,
        siteAShopDomain: document.getElementById('shopA').value,
        siteBShopDomain: document.getElementById('shopB').value
      };

      try {
        await fetchJSON('/api/onboarding/mappings', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showFeedback('mapping-feedback', 'Mapeamento salvo com sucesso.', 'success');
        mappingForm.reset();
      } catch (error) {
        showFeedback('mapping-feedback', `Falha ao salvar mapeamento: ${error.message}`, 'error');
      }

      await refreshMappings();
      await refreshStatus();
    });
  }

  const edgeWorkerForm = document.getElementById('edge-worker-form');
  if (edgeWorkerForm) {
    edgeWorkerForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      showFeedback('edge-worker-feedback', 'Registrando servidor...', 'info');
      const payload = {
        id: document.getElementById('edgeWorkerId').value,
        label: document.getElementById('edgeWorkerLabel').value || undefined,
        endpointUrl: document.getElementById('edgeWorkerUrl').value,
        regions: document
          .getElementById('edgeWorkerRegions')
          .value.split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      };

      try {
        await fetchJSON('/api/onboarding/edge-workers', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showFeedback('edge-worker-feedback', 'Servidor salvo com sucesso.', 'success');
        edgeWorkerForm.reset();
      } catch (error) {
        showFeedback('edge-worker-feedback', `Falha ao salvar servidor: ${error.message}`, 'error');
      }

      await refreshEdgeWorkers();
      await refreshStatus();
    });
  }

  const cloudflareForm = document.getElementById('cloudflare-form');
  if (cloudflareForm) {
    cloudflareForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const accountId = document.getElementById('cloudflareAccountId').value;
      const apiToken = document.getElementById('cloudflareApiToken').value;
      const feedback = document.getElementById('cloudflare-output');
      feedback.textContent = 'Conectando à Cloudflare...';
      try {
        const result = await fetchJSON('/api/onboarding/cloudflare/connect', {
          method: 'POST',
          body: JSON.stringify({ accountId, apiToken })
        });
        feedback.innerHTML = `
          <p>${result.message}</p>
          <p>Workers sincronizados: <strong>${result.workerCount}</strong></p>
        `;
        cloudflareForm.reset();
        await refreshCloudflareStatus();
        await refreshEdgeWorkers();
        await refreshStatus();
      } catch (error) {
        feedback.textContent = `Falha ao conectar: ${error.message}`;
      }
    });
  }

  const testButton = document.getElementById('generate-test-link');
  if (testButton) {
    testButton.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const mappingSelect = document.getElementById('testMapping');
      const output = document.getElementById('test-link-output');
      if (!mappingSelect.value) {
        output.textContent = 'Selecione um mapeamento válido antes de gerar o checkout.';
        return;
      }

      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = 'Gerando...';
      output.textContent = 'Gerando checkout de teste...';

      try {
        const result = await fetchJSON('/api/onboarding/test-link', {
          method: 'POST',
          body: JSON.stringify({ mappingId: mappingSelect.value })
        });
        output.innerHTML = `
          <p>Link gerado com sucesso!</p>
          ${result.originShop ? `<p>Origem: <strong>${result.originShop}</strong></p>` : ''}
          ${result.targetShop ? `<p>Destino: <strong>${result.targetShop}</strong></p>` : ''}
          ${result.edgeWorker ? `<p>Servidor: <strong>${result.edgeWorker.label || result.edgeWorker.id}</strong></p>` : ''}
          <a href="${result.checkoutUrl}" target="_blank" rel="noopener">Abrir checkout de teste</a>
        `;
        await refreshDashboard();
      } catch (error) {
        output.textContent = `Falha ao gerar link: ${error.message}`;
      }

      button.textContent = originalLabel;
      await refreshStatus();
    });
  }

  const edgeForm = document.getElementById('edge-form');
  if (edgeForm) {
    edgeForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const output = document.getElementById('edge-result');
      const payload = {
        product_x_id: document.getElementById('edgeProduct').value,
        channel: document.getElementById('edgeChannel').value || undefined,
        quantity: Number(document.getElementById('edgeQuantity').value || '1')
      };

      const workerSelect = document.getElementById('edgeWorkerSelect');
      const runner = workerSelect ? workerSelect.value : 'local';
      const usingRemoteWorker = runner && runner !== 'local';

      let endpoint = buildLocalEdgeEndpoint();
      if (usingRemoteWorker) {
        const remoteWorker = cachedEdgeWorkers.find((worker) => worker.id === runner);
        if (!remoteWorker || !remoteWorker.endpointUrl) {
          output.textContent = 'Worker selecionado não possui endpoint válido cadastrado.';
          return;
        }
        endpoint = remoteWorker.endpointUrl;
      }

      output.textContent = 'Executando decisão de roteamento...';

      try {
        const result = await fetchJSON(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
          mode: usingRemoteWorker ? 'cors' : undefined,
          skipHealthUpdate: shouldSkipHealthCheck(endpoint, usingRemoteWorker)
        });
        output.innerHTML = `
          <p>Status: <strong>${result.status}</strong></p>
          ${result.originShop ? `<p>Origem: ${result.originShop}</p>` : ''}
          ${result.targetShop ? `<p>Destino: ${result.targetShop}</p>` : ''}
          ${result.edgeWorker ? `<p>Servidor: ${result.edgeWorker.label || result.edgeWorker.id}</p>` : ''}
          <p>Execução: ${usingRemoteWorker ? 'Worker Cloudflare selecionado' : 'Backend local'}</p>
          ${result.checkoutUrl ? `<a href="${result.checkoutUrl}" target="_blank" rel="noopener">Abrir checkout seguro</a>` : ''}
        `;
      } catch (error) {
        output.textContent = `Falha ao executar decisão: ${error.message}`;
      }

      await refreshDashboard();
    });
  }

  const pingButton = document.getElementById('ping-worker');
  if (pingButton) {
    pingButton.addEventListener('click', async () => {
      const select = document.getElementById('edgeWorkerSelect');
      const output = document.getElementById('edge-worker-health');
      if (!select || !output) {
        return;
      }

      if (select.value === 'local') {
        output.textContent = 'O backend local Express está habilitado automaticamente para interceptações de teste.';
        return;
      }

      const worker = cachedEdgeWorkers.find((entry) => entry.id === select.value);
      if (!worker || !worker.endpointUrl) {
        output.textContent = 'Worker selecionado não possui endpoint válido cadastrado.';
        return;
      }

      try {
        const response = await fetch(worker.endpointUrl, {
          method: 'GET',
          mode: 'cors'
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || `Status ${response.status}`);
        }
        const data = await response.json();
        output.textContent = `Worker ativo (${worker.endpointUrl}): ${JSON.stringify(data, null, 2)}`;
      } catch (error) {
        output.textContent = `Falha ao consultar o worker: ${error.message}`;
      }
    });
  }

  await refreshShops();
  await refreshMappings();
  await refreshEdgeWorkers();
  await refreshCloudflareStatus();
  await refreshStatus();
  await refreshDashboard();
}

init().catch((error) => {
  console.error(error);
  if (connectivityBanner) {
    connectivityBanner.hidden = false;
    connectivityBanner.classList.remove('banner-info', 'banner-success');
    connectivityBanner.classList.add('banner-error');
    connectivityBanner.textContent = 'Erro ao inicializar a interface. Verifique o console.';
  }
});
