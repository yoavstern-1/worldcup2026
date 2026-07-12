// Cloudflare Worker — Gemini chat proxy for the World Cup 2026 site.
//
// SECRETS: no keys live in this file. Set them once with wrangler:
//   wrangler secret put GEMINI_KEYS         # comma-separated list of Gemini keys
//   wrangler secret put FOOTBALL_API_KEY    # optional; omit to skip live stats
// They arrive on `env` at runtime and are never committed.
//
// The worker returns a normalized shape so the page never has to walk Gemini's
// candidate/parts tree:
//   success -> { reply: "..." }
//   failure -> { error: { message, code } }   with a 4xx/5xx status
//
// Three things used to make the chat fail intermittently, and all three are
// fixed here:
//   1. gemini-2.5-flash thinks before it answers, and thinking tokens come out
//      of maxOutputTokens. At 512 the model regularly spent the whole budget on
//      thinking and returned a candidate with finishReason MAX_TOKENS and no
//      text parts at all — which the page rendered as a bare "⚠️ Error".
//      thinkingConfig.thinkingBudget = 0 turns that off.
//   2. google_search grounding was forced on every call. It roughly doubles
//      latency and fails on its own (grounding timeouts, empty candidates). The
//      page already ships the full fixture list and results in the system
//      prompt, so the search tool bought nothing and cost reliability.
//   3. A key was only rotated on a quota error, and a network wobble or a 5xx
//      was returned to the user as-is. Now every key is retried and every key is
//      tried before giving up.

const MODEL = 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const GEMINI_TIMEOUT_MS = 25000;
const PER_KEY_ATTEMPTS = 2;

// Cache football data for 10 minutes to stay under the rate limit
let footballCache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000;

async function fetchFootballData(apiKey) {
  if (!apiKey) return '';
  const now = Date.now();
  if (footballCache.data !== null && now - footballCache.ts < CACHE_TTL) {
    return footballCache.data;
  }

  const headers = { 'X-Auth-Token': apiKey };
  const [scorersRes, standingsRes] = await Promise.allSettled([
    fetch('https://api.football-data.org/v4/competitions/WC/scorers?season=2026&limit=20', { headers }),
    fetch('https://api.football-data.org/v4/competitions/WC/standings?season=2026', { headers }),
  ]);

  let summary = '';

  if (scorersRes.status === 'fulfilled' && scorersRes.value.ok) {
    const d = await scorersRes.value.json();
    if (d.scorers && d.scorers.length > 0) {
      summary += '\n\n=== TOP SCORERS (World Cup 2026) ===\n';
      d.scorers.slice(0, 20).forEach((s, i) => {
        summary += `${i + 1}. ${s.player.name} (${s.team.name}) — ${s.goals} goals, ${s.assists || 0} assists, ${s.playedMatches} games\n`;
      });
    }
  }

  if (standingsRes.status === 'fulfilled' && standingsRes.value.ok) {
    const d = await standingsRes.value.json();
    if (d.standings && d.standings.length > 0) {
      summary += '\n\n=== GROUP STANDINGS ===\n';
      d.standings.forEach((group) => {
        summary += `\nGroup ${group.group || ''}:\n`;
        (group.table || []).forEach((row) => {
          summary += `  ${row.position}. ${row.team.name} — P:${row.playedGames} W:${row.won} D:${row.draw} L:${row.lost} GF:${row.goalsFor} GA:${row.goalsAgainst} Pts:${row.points}\n`;
        });
      });
    }
  }

  footballCache = { data: summary, ts: now };
  return summary;
}

// A hung upstream must not become a hung page.
async function callGemini(key, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(GEMINI_BASE + MODEL + ':generateContent?key=' + key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

// All the text parts of the first candidate, joined. A candidate can legitimately
// arrive split across several parts; taking only parts[0] dropped answers.
function textOf(data) {
  const c = data && data.candidates && data.candidates[0];
  const parts = (c && c.content && c.content.parts) || [];
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
}

function blockReason(data) {
  const c = data && data.candidates && data.candidates[0];
  if (data && data.promptFeedback && data.promptFeedback.blockReason) {
    return 'blocked: ' + data.promptFeedback.blockReason;
  }
  if (c && c.finishReason && c.finishReason !== 'STOP') return 'finish: ' + c.finishReason;
  return '';
}

// Worth trying another key / another attempt? Quota, auth, rate limit, and any
// 5xx are transient from our side. A malformed request is not.
function isTransient(status, data) {
  if (status === 429 || status >= 500) return true;
  const msg = ((data && data.error && data.error.message) || '').toLowerCase();
  const code = data && data.error && data.error.code;
  if (code === 429 || code === 403 || code === 503 || (code >= 500 && code < 600)) return true;
  return (
    msg.includes('quota') || msg.includes('rate') || msg.includes('overloaded') ||
    msg.includes('api key') || msg.includes('unavailable') || msg.includes('high demand') ||
    msg.includes('exhausted') || msg.includes('internal')
  );
}

function parseKeys(env) {
  // GEMINI_KEYS is a comma-separated secret; also accept GEMINI_KEY_1..N.
  const list = [];
  if (env.GEMINI_KEYS) {
    env.GEMINI_KEYS.split(',').forEach((k) => {
      const t = k.trim();
      if (t) list.push(t);
    });
  }
  for (let i = 1; i <= 20; i++) {
    const v = env['GEMINI_KEY_' + i];
    if (v && v.trim()) list.push(v.trim());
  }
  return list;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const keys = parseKeys(env);
    if (keys.length === 0) {
      return json({ error: { message: 'Server not configured: no Gemini keys set.' } }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: { message: 'Invalid JSON' } }, 400);
    }
    if (!body || !Array.isArray(body.contents) || body.contents.length === 0) {
      return json({ error: { message: 'No message' } }, 400);
    }

    let footballData = '';
    try {
      footballData = await fetchFootballData(env.FOOTBALL_API_KEY);
    } catch {
      footballData = '';
    }

    const existingSystem = body.system_instruction?.parts?.[0]?.text || '';
    const enrichedSystem =
      existingSystem +
      (footballData ? '\n\nYou also have access to the following LIVE data from football-data.org:' + footballData : '');

    const cfg = body.generationConfig || {};
    const enrichedBody = {
      contents: body.contents,
      system_instruction: { parts: [{ text: enrichedSystem }] },
      generationConfig: {
        temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.4,
        // Leave real headroom for the answer. The old 512 was shared with the
        // model's own thinking tokens, so long answers came back truncated —
        // or empty.
        maxOutputTokens: Math.min(Math.max(cfg.maxOutputTokens || 1024, 512), 2048),
        // No thinking: this is fixture lookup over data we already handed it.
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    let lastErr = 'unknown error';

    for (let k = 0; k < keys.length; k++) {
      for (let attempt = 0; attempt < PER_KEY_ATTEMPTS; attempt++) {
        let status, data;
        try {
          ({ status, data } = await callGemini(keys[k], enrichedBody));
        } catch (err) {
          lastErr = err && err.name === 'AbortError' ? 'upstream timeout' : String(err && err.message || err);
          await sleep(300);
          continue;   // same key, one more go — then the next key
        }

        const reply = textOf(data);
        if (reply) return json({ reply });

        lastErr = (data && data.error && data.error.message) || blockReason(data) || 'empty response';

        // A safety block or a malformed request will fail identically on every
        // key — stop rather than burn the whole keyring on it.
        if (!isTransient(status, data)) {
          if (blockReason(data).startsWith('blocked')) {
            return json({ error: { message: 'Message was blocked by the safety filter.' } }, 400);
          }
          break;   // next key: an empty candidate can be key-specific
        }
        await sleep(300 * (attempt + 1));
      }
    }

    return json({ error: { message: lastErr } }, 502);
  },
};
