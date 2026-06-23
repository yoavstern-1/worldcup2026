// ──────────────────────────────────────────────────────────────
// Cloudflare Worker — Gemini proxy for the World Cup 2026 chat
// ──────────────────────────────────────────────────────────────
// This tiny server sits between the static page and Google Gemini.
// The API key is stored as an encrypted Worker secret (GEMINI_KEY),
// so it never appears in the public GitHub repo or in the browser.
//
// DEPLOY (free, no credit card):
//   1. Create a free account at https://dash.cloudflare.com
//   2. Compute  →  Workers & Pages  →  Create  →  Create Worker
//   3. Name it e.g. "worldcup-ai"  →  Deploy
//   4. Click "Edit code", replace everything with this file, then Deploy
//   5. Settings → Variables and Secrets → Add → type: Secret
//        Name:  GEMINI_KEY
//        Value: <your Gemini API key>
//      Save and Deploy
//   6. Copy the worker URL (e.g. https://worldcup-ai.<sub>.workers.dev)
//      and paste it into main.js → CHAT_PROXY_URL
//
// Optional: lock ALLOWED_ORIGIN to your GitHub Pages URL to stop others
// from using your quota. Leave as '*' to allow any origin.

const ALLOWED_ORIGIN = '*';
const MODEL = 'gemini-2.5-flash';

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: { message: 'POST only' } }), {
        status: 405,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    if (!env.GEMINI_KEY) {
      return new Response(JSON.stringify({ error: { message: 'GEMINI_KEY secret not set on the Worker' } }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await request.text();
    } catch (e) {
      body = '';
    }

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      MODEL + ':generateContent?key=' + env.GEMINI_KEY;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
