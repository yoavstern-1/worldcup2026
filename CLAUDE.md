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
// t = { stages:{group,r32,r16,qf,sf,third,final}, all, updatedAt, fetchedAt, stale, error, hasLive }
```
`Match = { id, stage, utc, date, time, dayKey, home, away, status:'past'|'live'|'future',
           statusName, period, clock, displayClock,
           score, pens, winner, venue, group, note, strip:'safe'|'warn'|'danger',
           events:[{kind:'goal'|'pk'|'og'|'yellow'|'red', side, min, sec, player}],
           stats:{home:{poss,shots,sog,corners,fouls}, away:{…}}, bracketIndex }`
`Team  = { abbr, id, en, he, flag, placeholder, ref }`

Helpers: `WC.currentStage(t)`, `WC.stageState(t, key)`, `WC.tournamentStats(t)`, `WC.upcoming(t)`,
`WC.liveMatches(t)`, `WC.livePhase(m)`, `WC.liveMinute(m, fetchedAt)`, `WC.refMatch(t, team)`,
`WC.ilParts(date)`, `WC.stripFor(date)`, `WC.flagFor(team)`, `WC.flagsSupported()`,
`WC.venueName(m, he)`, `WC.playerName(name, he)`.

### ESPN endpoint
`site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300`
Returns **all 104 matches in one request**, tagged by `season.slug` (`group-stage`,
`round-of-32`, … `final`), with `winner`, `shootoutScore`, and placeholder competitors
(`"Quarterfinal 2 Winner"`, abbr `QFW2`) that encode the bracket tree.
Group letter only appears in `competitions[0].altGameNote` (`"FIFA World Cup, Group A"`).

The same payload carries far more than the site used to read:
- `competitions[0].details[]` — **every goal** (scorer, minute, penalty / own goal /
  shootout flags) and **every card**. This is where the Data tab's top-scorer board,
  penalty count and discipline numbers come from. Shootout kicks appear here too and
  must be skipped, or they double-count against `pens`.
- `competitors[].statistics[]` — possession, shots, shots on target, corners, fouls.
- `status` — `clock` (seconds elapsed: 2700 at HT, 7200 at the end of ET), `displayClock`
  (`"120'+2'"`), and `period` (1–2 regulation, 3–4 extra time, 5 shootout).

---

## Hard-won gotchas — do not regress these

- **A scoreline must never be a number pair beside a name pair.** The old card put the two
  names in a flex row (home first, so home sat on the **right** under RTL) and the score in
  an LTR-isolated box (home's goal on the **left**). The two halves disagreed and every
  result read backwards in Hebrew — "England beat Norway 2-1" rendered as 1-2. The fix is
  structural, not a `direction:` patch: **one row per team, each team's goals on its own
  line** (`.mc-rows` / `.mc-row`). A row cannot disagree with itself. The same component is
  reused by the card, the today banner and the head-to-head search — do not reintroduce a
  separate score box anywhere.
- **`#recCards` vs `.bracket-box`**: `buildRecs()` overwrote `#recCards` on every refresh.
  The bracket used to live there and was silently destroyed ~50ms after every page load.
  It now renders into **every** `.bracket-box` (one per knockout tab: R16 / QF / SF / Final),
  so it is on screen whichever round the user opens — not only the current one.
- **Bracket tree comes from `team.ref`**, not array order. Array order is kickoff order.
- **Stage sub-headings are derived** (`WC.stageState` → `renderStageHeads`). They used to be
  hardcoded in `index.html`, so "🔥 Quarter-finals start today!" was still on the page days
  after the quarter-finals ended. Nothing date-dependent belongs in the HTML.
- **`currentStage` ignores a stage whose matches today are already over.** On the evening of
  the last quarter-final, "current" is the semi-final. Matching on "any match today" pinned
  the site to a round with nothing left to play.
- **The live minute is extrapolated**, not read: `WC.liveMinute()` = ESPN's `clock` plus the
  time since `t.fetchedAt`, so it ticks between the 60s refreshes instead of sitting frozen.
  It returns `''` during half-time / the ET break / a shootout — the clock is not running
  and a frozen "45+1'" reads as broken. The phase label takes the slot instead.
- **Live is amber, not red.** `--danger` is already the "deep night" strip colour; a red dot
  on a card that also has a red strip is unreadable. `--live` + a 1.8s `livePulse`.
- **Israel time is computed as UTC+3 explicitly** (`WC.ilParts`), never via browser timezone —
  a user in Berlin must still see Israeli kickoff times.
- **ESPN dates lack seconds** (`2026-06-11T19:00Z`). Old iOS Safari returns `Invalid Date`;
  `parseUTC()` in data.js has a manual fallback. Don't replace it with bare `new Date()`.
- **A scheduled match reports `score: "0"`.** That's an absence, not a score → `score: null`.
- **RTL flips digits.** Any score/date needs `direction:ltr; unicode-bidi:isolate`.
- **Windows has no flag-emoji font.** `🇪🇸` degrades to "ES", England's tag sequence to a bare
  black flag. `WC.flagFor()` detects support and, where there is none, shows **no flag at
  all**. It used to fall back to a 3-letter Latin chip (`ENG`), which put English next to
  every Hebrew team name. In Hebrew the page shows **nothing in Latin script**: team names,
  venues (`VENUE_HE`, all 16 stadiums) and the top scorers (`PLAYER_HE`) are all translated.
  Anything new that renders a proper noun needs an entry in one of those maps.
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

`worker.js` reads the Gemini key from `env.GEMINI_KEY` (what production actually binds),
`env.GEMINI_KEYS` (comma-separated) or `env.GEMINI_KEY_1..N`, plus `env.FOOTBALL_API_KEY`.
**Never put a key in code.**

- **The binding is `GEMINI_KEY` — singular.** It was created by hand in the dashboard long
  before `wrangler.toml` existed. `parseKeys()` used to read only the plural names, so a
  correctly-configured worker still answered "no Gemini keys set". It reads all three now.
- **A key must be a `secret_text` binding, never `plain_text`.** `wrangler deploy` replaces
  non-secret vars with whatever the config declares, and `wrangler.toml` declares none — so a
  deploy silently **wipes a dashboard-set plain_text key** and every chat request 500s. This
  happened. The key is now `secret_text` (`wrangler versions secret put GEMINI_KEY`), which
  survives deploys. If you ever see `[]` from `wrangler secret list`, stop before deploying.
- **To ship worker changes without an outage**, don't `wrangler deploy` — build the version
  first and only then move traffic:
  ```
  wrangler versions upload                       # new code, not live
  wrangler versions secret put GEMINI_KEY        # -> new version carrying the secret
  wrangler versions deploy <id>@100%             # atomic switch
  wrangler rollback <previous-id> --yes          # one command back
  ```

### Why the chat used to fail at random

Measured against the live worker, not guessed:

1. **`gemini-2.5-flash` thinks before it answers, and thinking tokens come out of
   `maxOutputTokens`.** At the old cap of 512, a long question spent **977 tokens thinking**,
   hit `finishReason: MAX_TOKENS`, and returned a **43-character stub** — or a candidate with
   no text parts at all, which the page rendered as a bare "⚠️ שגיאה". Fixed with
   `thinkingConfig: { thinkingBudget: 0 }` (set in both the worker *and* the page, so the
   page is correct even before the worker is redeployed) and a 1024-token cap.
2. **The worker forced `tools: [{ google_search: {} }]` on every call**, which roughly
   **doubled** token usage (8.1k vs 4.1k per question) and burned the free-tier quota into
   the ground — the real source of the intermittent "API error". The page already ships every
   fixture and result in the system prompt, so grounding bought nothing. Removed.
3. **Only `parts[0].text` was read.** Gemini legitimately splits an answer across parts; a
   two-part reply was silently truncated. Join them all.

4. **Grounding also made the answers wrong, not just expensive.** Gemini preferred stale
   search results over the exact fixture data in the system prompt: asked how many goals had
   been scored it said **173**, and on another run "11 goals in 50 matches, as of 25 June".
   The model said **292 in 100**. With `google_search` gone the chat now matches the model.

**Key rotation does nothing.** All four fix branches "solved" the quota error by retrying
across keys. Free-tier quota is metered **PerProjectPerModel**: every key issued from one
Google Cloud project draws on **one** bucket (observed 429: `limit: 20, model:
gemini-2.5-flash`), so once it is empty every key 429s together. A different *model* has its
own bucket — hence `MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']`, tried in that
order. `isQuota()` distinguishes a spent bucket from any other transient failure, so a real
exhaustion returns an explicit 429 instead of falling off the end of the loop (which
Cloudflare turns into "Response not returned", i.e. a bogus connection error).

The worker returns `{ reply }` / `{ error: { message } }` — the page never walks Gemini's
candidate tree, though `replyOf()` still tolerates a raw payload in case an older worker is
deployed. The page has a 30s timeout, two retries, and a **"try again" button** on every
failure, and drops the unanswered turn from `chatHistory` (replaying it made the next
question fail too).

An earlier commit leaked 7 Gemini keys + 1 football-data key. They have been **rotated**
and are dead; git history was deliberately left intact (no force-push, no filter-repo).

---

## Dev

```
node serve.js            # http://localhost:8099  (ESPN blocks file://)
PORT=8177 node serve.js  # when 8099 is already taken
node --check *.js        # syntax
```
`dist/` is generated (gitignored) for Cloudflare Pages direct upload — copy of the 7 site files.

Headless Chromium reports `prefers-reduced-motion: reduce`, so the WebGL intro takes its
static path and is gone ~1.5s in. To see the ball in an automated run, stub `matchMedia`
before load.

## Open / not done

- **`worker.js` is not deployed.** The chat fixes that live in the worker (no grounding, key
  rotation, `{reply}` shape) need `npx wrangler deploy`. The page-side half of the fix works
  without it.
- Standings tab was removed (was empty and claimed "updates via ESPN API" — untrue).
- `PLAYER_HE` covers the current top ~30 scorers; a new name entering the top 5 will render
  in Latin until it is added.
- Verified only in Chromium (incl. headless WebGL). **Not tested on real Safari/iOS.**
