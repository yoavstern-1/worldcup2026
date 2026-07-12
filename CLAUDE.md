# World Cup 2026 — project context

Static fan site: full WC26 schedule in Israel time, live results, knockout bracket, AI chat.
Hebrew (RTL) + English toggle, dark/light themes. Vanilla JS, no build step.

**Live:** https://yoavstern1357.github.io/worldcup2026/
**Repo:** github.com/yoavstern1357/worldcup2026 (branch `main`)
**Chat proxy:** https://worldcup-ai.yoavstern1357.workers.dev (Cloudflare Worker)

---

## Architecture — one data model, nothing scrapes the DOM

The original code scraped its own rendered HTML to rebuild data it already had.
That single mistake caused every major bug (bracket wiped on refresh, chat saying
"no matches today", group stage vanishing). **Do not reintroduce DOM scraping.**

| File | Role |
|---|---|
| `data.js` | **Single source of truth.** One ESPN fetch → all 104 matches. Exposes `window.WC`. |
| `bracket.js` | Renders knockout tree into `#bracketBox`. **Must never touch `#recCards`.** |
| `main.js` | Renders stages, today banner, Data tab, team search, chat. Reads the model. |
| `visual_upgrade.js` | Injected CSS, ball icon on chat button, scroll-fade. |
| `splash3d.js` | WebGL intro (ES module). Falls back to flat SVG if no WebGL. |
| `three.module.min.js` | Three.js 0.160, bundled locally (MIT). Offline-safe, no CDN. |
| `worker.js` | Cloudflare Worker: Gemini chat proxy. **Keys come from `env`, never code.** |
| `serve.js` | Dev server only (`node serve.js` → localhost:8099). ESPN blocks `file://`. |

### The data model (`window.WC`)
```js
WC.load(function(err, t) { ... })   // node-style cb, never throws
// t = { stages:{group,r32,r16,qf,sf,third,final}, all, updatedAt, stale, error, hasLive }
```
`Match = { id, stage, utc, date, time, dayKey, home, away, status:'past'|'live'|'future',
           score, pens, winner, venue, group, note, strip:'safe'|'warn'|'danger', bracketIndex }`
`Team  = { abbr, en, he, flag, placeholder, ref }`

Helpers: `WC.currentStage(t)`, `WC.upcoming(t)`, `WC.liveMatches(t)`, `WC.refMatch(t, team)`,
`WC.ilParts(date)`, `WC.stripFor(date)`, `WC.flagFor(team)`, `WC.flagsSupported()`.

### ESPN endpoint
`site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300`
Returns **all 104 matches in one request**, tagged by `season.slug` (`group-stage`,
`round-of-32`, … `final`), with `winner`, `shootoutScore`, and placeholder competitors
(`"Quarterfinal 2 Winner"`, abbr `QFW2`) that encode the bracket tree.
Group letter only appears in `competitions[0].altGameNote` (`"FIFA World Cup, Group A"`).

---

## Hard-won gotchas — do not regress these

- **`#recCards` vs `#bracketBox`**: `buildRecs()` overwrites `#recCards` on every refresh.
  The bracket used to live there and was silently destroyed ~50ms after every page load.
- **Bracket tree comes from `team.ref`**, not array order. Array order is kickoff order.
- **Israel time is computed as UTC+3 explicitly** (`WC.ilParts`), never via browser timezone —
  a user in Berlin must still see Israeli kickoff times.
- **ESPN dates lack seconds** (`2026-06-11T19:00Z`). Old iOS Safari returns `Invalid Date`;
  `parseUTC()` in data.js has a manual fallback. Don't replace it with bare `new Date()`.
- **A scheduled match reports `score: "0"`.** That's an absence, not a score → `score: null`.
- **RTL flips digits.** Any score/date needs `direction:ltr; unicode-bidi:isolate`.
- **Windows has no flag-emoji font.** `🇪🇸` degrades to "ES", England's tag sequence to a bare
  black flag. `WC.flagFor()` detects support and falls back to 3-letter chips for *all* teams.
- **`setLang()` only rewrites `textContent` of `[data-he]`.** Every rendered string needs
  `data-he`/`data-en`. Placeholders need `data-ph-he`/`data-ph-en` (handled separately).
- **Odd card counts**: grids orphan the last card into a column. `.mgrid` is **flex**
  (`flex-wrap` + `justify-content:center`) so a lone 3rd card centres under the two above.
- **`color-mix()` needs Safari 16.2+** — always ship an `rgba()` fallback line before it.

---

## Style

Vanilla JS: `var`, function declarations, no arrows/async/optional-chaining — match existing code.
CSS: variables only (`--bg`, `--gold`, `--t1`…), no hardcoded colours.
Palette: deep emerald + champagne (`--bg:#0a1f16`, `--gold:#d9b866`). Light = warm ivory.
Fonts: **Sora** (Latin) + **Assistant** (Hebrew) — browser picks per glyph.

---

## Security

`worker.js` reads `env.GEMINI_KEYS` (comma-separated) and `env.FOOTBALL_API_KEY`,
set via `wrangler secret put` / Cloudflare dashboard. **Never put a key in code.**

An earlier commit leaked 7 Gemini keys + 1 football-data key. They have been **rotated**
and are dead; git history was deliberately left intact (no force-push, no filter-repo).

---

## Dev

```
node serve.js     # http://localhost:8099  (ESPN blocks file://)
node --check *.js # syntax
```
`dist/` is generated (gitignored) for Cloudflare Pages direct upload — copy of the 7 site files.

## Open / not done

- Standings tab was removed (was empty and claimed "updates via ESPN API" — untrue).
- Chat has never been exercised end-to-end against a long real answer in a real browser.
- Verified only in Chromium (incl. headless WebGL). **Not tested on real Safari/iOS.**
