const GEMINI_KEYS = [
  'REDACTED_SEE_GIT_HISTORY_PURGE',
  'REDACTED_SEE_GIT_HISTORY_PURGE',
  'REDACTED_SEE_GIT_HISTORY_PURGE',
  'REDACTED_SEE_GIT_HISTORY_PURGE',
  'REDACTED_SEE_GIT_HISTORY_PURGE',
  'REDACTED_SEE_GIT_HISTORY_PURGE',
  'REDACTED_SEE_GIT_HISTORY_PURGE',
];

const FOOTBALL_API_KEY = 'REDACTED_SEE_GIT_HISTORY_PURGE';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=';

// Cache football data for 10 minutes to avoid hitting rate limits
let footballCache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000;

async function fetchFootballData() {
  const now = Date.now();
  if (footballCache.data && (now - footballCache.ts) < CACHE_TTL) {
    return footballCache.data;
  }

  const headers = { 'X-Auth-Token': FOOTBALL_API_KEY };

  // Fetch WC 2026 scorers and teams in parallel
  const [scorersRes, matchesRes, standingsRes] = await Promise.allSettled([
    fetch('https://api.football-data.org/v4/competitions/WC/scorers?season=2026&limit=20', { headers }),
    fetch('https://api.football-data.org/v4/competitions/WC/matches?season=2026&status=FINISHED', { headers }),
    fetch('https://api.football-data.org/v4/competitions/WC/standings?season=2026', { headers }),
  ]);

  let summary = '';

  // Scorers
  if (scorersRes.status === 'fulfilled' && scorersRes.value.ok) {
    const d = await scorersRes.value.json();
    if (d.scorers && d.scorers.length > 0) {
      summary += '\n\n=== TOP SCORERS (World Cup 2026) ===\n';
      d.scorers.slice(0, 20).forEach((s, i) => {
        summary += `${i+1}. ${s.player.name} (${s.team.name}) — ${s.goals} goals, ${s.assists || 0} assists, ${s.playedMatches} games\n`;
      });
    }
  }

  // Standings
  if (standingsRes.status === 'fulfilled' && standingsRes.value.ok) {
    const d = await standingsRes.value.json();
    if (d.standings && d.standings.length > 0) {
      summary += '\n\n=== GROUP STANDINGS ===\n';
      d.standings.forEach(group => {
        summary += `\nGroup ${group.group || ''}:\n`;
        (group.table || []).forEach(row => {
          summary += `  ${row.position}. ${row.team.name} — P:${row.playedGames} W:${row.won} D:${row.draw} L:${row.lost} GF:${row.goalsFor} GA:${row.goalsAgainst} Pts:${row.points}\n`;
        });
      });
    }
  }

  footballCache = { data: summary, ts: now };
  return summary;
}

async function callGemini(key, body) {
  const res = await fetch(GEMINI_BASE + key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: { message: 'Invalid JSON' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Fetch live football data and inject into system prompt
    let footballData = '';
    try {
      footballData = await fetchFootballData();
    } catch (e) {
      footballData = '';
    }

    // Inject football data into the system instruction
    const existingSystem = body.system_instruction?.parts?.[0]?.text || '';
    const enrichedSystem = existingSystem + (footballData
      ? '\n\nYou also have access to the following LIVE data from football-data.org:' + footballData
      : '');

    const enrichedBody = {
      ...body,
      system_instruction: { parts: [{ text: enrichedSystem }] },
      tools: [{ google_search: {} }]
    };

    // Try each key with automatic rotation on quota errors
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      try {
        const data = await callGemini(GEMINI_KEYS[i], enrichedBody);

        if (data.error) {
          const code = data.error.code;
          const msg = (data.error.message || '').toLowerCase();
          const isQuota = code === 429 || code === 403 ||
            msg.includes('quota') || msg.includes('rate') ||
            msg.includes('api key') || msg.includes('invalid') ||
            msg.includes('high demand');

          if (isQuota && i < GEMINI_KEYS.length - 1) continue;
        }

        return new Response(JSON.stringify(data), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        });

      } catch (err) {
        if (i < GEMINI_KEYS.length - 1) continue;
        return new Response(JSON.stringify({ error: { message: err.message } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }
  }
};
