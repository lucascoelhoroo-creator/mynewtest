export default {
  async fetch(request, env) {
    const allowedOrigin = request.headers.get('origin') ?? '*';
    const corsHeaders = {
      'access-control-allow-origin': allowedOrigin,
      'access-control-allow-methods': 'POST,OPTIONS,GET',
      'access-control-allow-headers': request.headers.get('access-control-request-headers') ?? 'content-type',
      'access-control-max-age': '86400'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === 'GET') {
      const body = {
        status: 'ok',
        workerId: env.WORKER_ID ?? 'cloudflare-worker',
        expects: {
          method: 'POST',
          contentType: 'application/json',
          backend: 'BACKEND_INTERCEPT_URL secret'
        }
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { ...corsHeaders, 'content-type': 'application/json' }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { ...corsHeaders, allow: 'POST, OPTIONS, GET' }
      });
    }

    const backendUrl = env.BACKEND_INTERCEPT_URL;
    if (!backendUrl) {
      return new Response('BACKEND_INTERCEPT_URL not configured', {
        status: 500,
        headers: corsHeaders
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      return new Response('Invalid JSON payload', {
        status: 400,
        headers: corsHeaders
      });
    }

    try {
      const upstreamResponse = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-ab-jump-worker': env.WORKER_ID ?? 'cloudflare-worker'
        },
        body: JSON.stringify(payload)
      });

      const responseBody = await upstreamResponse.text();
      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.set('x-ab-jump-worker', env.WORKER_ID ?? 'cloudflare-worker');
      responseHeaders.set('access-control-allow-origin', corsHeaders['access-control-allow-origin']);
      responseHeaders.set('access-control-allow-methods', corsHeaders['access-control-allow-methods']);
      responseHeaders.set('access-control-allow-headers', corsHeaders['access-control-allow-headers']);
      responseHeaders.set('access-control-max-age', corsHeaders['access-control-max-age']);

      return new Response(responseBody, {
        status: upstreamResponse.status,
        headers: responseHeaders
      });
    } catch (error) {
      return new Response(`Upstream error: ${error.message}`, {
        status: 502,
        headers: corsHeaders
      });
    }
  }
};
