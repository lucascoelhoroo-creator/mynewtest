const DEFAULT_GITHUB_STATIC_BASE =
  'https://raw.githubusercontent.com/lucascoelhoroo-creator/mynewtest/codex/develop-checkout-routing-system-prototype';

function contentTypeFromPath(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.html')) return 'text/html; charset=UTF-8';
  if (lower.endsWith('.css')) return 'text/css; charset=UTF-8';
  if (lower.endsWith('.js')) return 'application/javascript; charset=UTF-8';
  if (lower.endsWith('.json')) return 'application/json; charset=UTF-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function isApiRequest(pathname) {
  return pathname.startsWith('/api/') || pathname.startsWith('/webhooks/');
}

function normaliseBaseUrl(value) {
  if (!value) return value;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function resolveBackendBaseUrl(env) {
  if (env.BACKEND_BASE_URL) {
    return normaliseBaseUrl(env.BACKEND_BASE_URL);
  }

  const intercept = env.BACKEND_INTERCEPT_URL;
  if (!intercept) {
    return null;
  }

  try {
    const parsed = new URL(intercept);
    const interceptPath = parsed.pathname.replace(/\/$/, '');
    const trimmedPath = interceptPath.replace(/\/api\/edge\/intercept$/, '');
    parsed.pathname = trimmedPath || '/';
    parsed.search = '';
    parsed.hash = '';
    return normaliseBaseUrl(parsed.toString());
  } catch (error) {
    console.error('Failed to derive backend base URL from BACKEND_INTERCEPT_URL', error);
    return null;
  }
}

async function proxyToBackend(request, targetUrl, workerId, corsHeaders) {
  const init = {
    method: request.method,
    headers: new Headers(request.headers),
    redirect: 'manual'
  };

  init.headers.delete('host');
  init.headers.set('x-ab-jump-worker', workerId);

  if (!['GET', 'HEAD'].includes(request.method)) {
    const body = await request.clone().arrayBuffer();
    init.body = body;
  }

  const upstream = await fetch(targetUrl, init);
  const headers = new Headers(upstream.headers);
  headers.set('x-ab-jump-worker', workerId);
  headers.set('access-control-allow-origin', corsHeaders['access-control-allow-origin']);
  headers.set('access-control-allow-methods', corsHeaders['access-control-allow-methods']);
  headers.set('access-control-allow-headers', corsHeaders['access-control-allow-headers']);
  headers.set('access-control-max-age', corsHeaders['access-control-max-age']);

  return new Response(upstream.body, { status: upstream.status, headers });
}

async function handleIntercept(request, env, corsHeaders) {
  const backendUrl = env.BACKEND_INTERCEPT_URL;
  if (!backendUrl) {
    return new Response('BACKEND_INTERCEPT_URL not configured', {
      status: 500,
      headers: corsHeaders
    });
  }

  let payload;
  try {
    payload = await request.clone().json();
  } catch (error) {
    return new Response('Invalid JSON payload', {
      status: 400,
      headers: corsHeaders
    });
  }

  const workerId = env.WORKER_ID ?? 'cloudflare-worker';

  const upstream = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ab-jump-worker': workerId
    },
    body: JSON.stringify(payload)
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('x-ab-jump-worker', workerId);
  responseHeaders.set('access-control-allow-origin', corsHeaders['access-control-allow-origin']);
  responseHeaders.set('access-control-allow-methods', corsHeaders['access-control-allow-methods']);
  responseHeaders.set('access-control-allow-headers', corsHeaders['access-control-allow-headers']);
  responseHeaders.set('access-control-max-age', corsHeaders['access-control-max-age']);

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: responseHeaders
  });
}

function buildStaticTarget(pathname, env) {
  const base = normaliseBaseUrl(env.GITHUB_STATIC_BASE || DEFAULT_GITHUB_STATIC_BASE);
  return `${base}${pathname}`;
}

async function serveStaticAsset(url, env, corsHeaders) {
  let pathname = url.pathname;
  if (!pathname || pathname === '/') {
    pathname = '/index.html';
  } else if (pathname.endsWith('/')) {
    pathname = `${pathname}index.html`;
  }

  const target = buildStaticTarget(pathname, env);
  const isHtml = pathname.endsWith('.html');

  const upstream = await fetch(target, {
    cf: { cacheTtl: isHtml ? 60 : 3600, cacheEverything: true }
  });

  if (upstream.status === 404 && !isHtml) {
    const fallback = await fetch(buildStaticTarget('/index.html', env), {
      cf: { cacheTtl: 60, cacheEverything: true }
    });

    if (fallback.ok) {
      const headers = new Headers(fallback.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');
      headers.set('access-control-allow-origin', corsHeaders['access-control-allow-origin']);
      headers.set('access-control-allow-methods', corsHeaders['access-control-allow-methods']);
      headers.set('access-control-allow-headers', corsHeaders['access-control-allow-headers']);
      headers.set('access-control-max-age', corsHeaders['access-control-max-age']);
      return new Response(await fallback.text(), {
        status: 200,
        headers
      });
    }
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const headers = new Headers(upstream.headers);
  headers.set('content-type', contentTypeFromPath(pathname));
  headers.set('access-control-allow-origin', corsHeaders['access-control-allow-origin']);
  headers.set('access-control-allow-methods', corsHeaders['access-control-allow-methods']);
  headers.set('access-control-allow-headers', corsHeaders['access-control-allow-headers']);
  headers.set('access-control-max-age', corsHeaders['access-control-max-age']);

  return new Response(upstream.body, {
    status: upstream.status,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const workerId = env.WORKER_ID ?? 'cloudflare-worker';
    const allowedOrigin = request.headers.get('origin') ?? '*';
    const corsHeaders = {
      'access-control-allow-origin': allowedOrigin,
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers':
        request.headers.get('access-control-request-headers') ?? 'content-type',
      'access-control-max-age': '86400'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === 'GET' && url.pathname === '/status') {
      const backendBase = resolveBackendBaseUrl(env);
      const body = {
        status: 'ok',
        workerId,
        expects: {
          method: 'POST',
          contentType: 'application/json',
          backend: env.BACKEND_INTERCEPT_URL ? 'BACKEND_INTERCEPT_URL secret' : 'missing',
          staticBase: env.GITHUB_STATIC_BASE || DEFAULT_GITHUB_STATIC_BASE,
          backendBase: backendBase || null
        }
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' }
      });
    }

    if (isApiRequest(url.pathname)) {
      const backendBase = resolveBackendBaseUrl(env);
      if (!backendBase) {
        return new Response('BACKEND_BASE_URL or BACKEND_INTERCEPT_URL required for API proxy', {
          status: 500,
          headers: corsHeaders
        });
      }
      const targetUrl = `${backendBase}${url.pathname}${url.search}`;
      return proxyToBackend(request, targetUrl, workerId, corsHeaders);
    }

    if (request.method === 'POST') {
      return handleIntercept(request, env, corsHeaders);
    }

    if (request.method === 'GET') {
      return serveStaticAsset(url, env, corsHeaders);
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...corsHeaders, allow: 'GET,POST,OPTIONS' }
    });
  }
};
