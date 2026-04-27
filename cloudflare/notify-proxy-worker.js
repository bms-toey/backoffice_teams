// Cloudflare Worker — CORS Proxy for BMS Notify API
// Deploy: https://workers.cloudflare.com → Create Worker → วาง code นี้ → Save & Deploy
// แล้วเอา URL ของ Worker (เช่น https://notify-proxy.yourname.workers.dev)
// ไปใส่ใน Settings → แจ้งเตือน → Proxy URL

const TARGET = 'https://api.notify.bmscloud.in.th/api/v1/push-notify';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Token, Content-Type',
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
  }

  const token = request.headers.get('Token') || '';
  let body = '';
  try { body = await request.text(); } catch(e) {}

  try {
    const resp = await fetch(TARGET, {
      method: 'POST',
      headers: { 'Token': token, 'Content-Type': 'application/json' },
      body: body,
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
}
