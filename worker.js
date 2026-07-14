// Cloudflare Worker — Gemini chat proxy for the World Cup 2026 site.
//
// SECRETS: no keys live in this file. Set them once with wrangler:
//   wrangler secret put GEMINI_KEYS         # comma-separated list of Gemini keys
//   wrangler secret put FOOTBALL_API_KEY    # optional; omit to skip live stats
// They arrive on `env` at runtime and are never committed.

const GEMINI_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=';

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

// gemini-2.5-flash runs with thinking ON by default, and thinking tokens are
// charged against maxOutputTokens. With a small budget the model spends it all
// on internal reasoning and returns a truncated answer -- or none at all, with
// `content.parts` missing entirely. Both are enforced here rather than trusted
// to the client, so no caller can under-budget the answer again.
const MIN_OUTPUT_TOKENS = 2048;

function withAnswerBudget(gen) {
  const cfg = { ...(gen || {}) };
  const asked = Number(cfg.maxOutputTokens) || 0;
  cfg.maxOutputTokens = Math.max(asked, MIN_OUTPUT_TOKENS);
  // 0 disables thinking; every token then goes to the visible answer.
  cfg.thinkingConfig = { thinkingBudget: 0, ...(cfg.thinkingConfig || {}) };
  return cfg;
}

async function callGemini(key, body) {
  const res = await fetch(GEMINI_BASE + key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
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

    const enrichedBody = {
      ...body,
      system_instruction: { parts: [{ text: enrichedSystem }] },
      tools: [{ google_search: {} }],
      generationConfig: withAnswerBudget(body.generationConfig),
    };

    // Try each key, rotating to the next on quota/auth errors
    let lastQuotaError = null;
    for (let i = 0; i < keys.length; i++) {
      try {
        const data = await callGemini(keys[i], enrichedBody);
        if (data.error) {
          const code = data.error.code;
          const msg = (data.error.message || '').toLowerCase();
          const isQuota =
            code === 429 || code === 403 ||
            msg.includes('quota') || msg.includes('rate') ||
            msg.includes('api key') || msg.includes('invalid') ||
            msg.includes('high demand');
          if (isQuota) {
            lastQuotaError = data.error;
            if (i < keys.length - 1) continue;
            // every key is spent -- say so plainly instead of leaking Google's
            // billing URLs into a chat bubble
            return json(
              { error: { code: 429, status: 'QUOTA_EXHAUSTED', message: 'All Gemini keys are out of quota.' } },
              429
            );
          }
        }
        return json(data);
      } catch (err) {
        if (i < keys.length - 1) continue;
        return json({ error: { message: err.message } }, 500);
      }
    }

    return json(
      { error: { code: 429, status: 'QUOTA_EXHAUSTED', message: (lastQuotaError && lastQuotaError.message) || 'No key succeeded.' } },
      429
    );
  },
};
