// ══════════════════════════════════════════════════════
// data.js — single source of truth for the tournament
//
// One request to ESPN returns all 104 matches tagged by stage, with winners,
// shootout scores, and placeholder teams for rounds not yet decided
// ("Quarterfinal 2 Winner"). Everything else in the app reads this model.
// Nothing scrapes the DOM.
// ══════════════════════════════════════════════════════
(function() {

var URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'
        + '?dates=20260611-20260719&limit=300';

var CACHE_KEY = 'wc26:v2';   // bump when the normalized shape or labels change
var TTL_LIVE  = 60 * 1000;
var TTL_IDLE  = 300 * 1000;

var IL_OFFSET_MS = 3 * 3600 * 1000;   // Israel is UTC+3 for the whole tournament window

var TEAMS = {
    ALG: {he:"אלג'יריה", en:"Algeria", flag:"🇩🇿"},
    ARG: {he:"ארגנטינה", en:"Argentina", flag:"🇦🇷"},
    AUS: {he:"אוסטרליה", en:"Australia", flag:"🇦🇺"},
    AUT: {he:"אוסטריה", en:"Austria", flag:"🇦🇹"},
    BEL: {he:"בלגיה", en:"Belgium", flag:"🇧🇪"},
    BIH: {he:"בוסניה", en:"Bosnia-Herzegovina", flag:"🇧🇦"},
    BRA: {he:"ברזיל", en:"Brazil", flag:"🇧🇷"},
    CAN: {he:"קנדה", en:"Canada", flag:"🇨🇦"},
    CIV: {he:"חוף השנהב", en:"Ivory Coast", flag:"🇨🇮"},
    COD: {he:"קונגו", en:"Congo DR", flag:"🇨🇩"},
    COL: {he:"קולומביה", en:"Colombia", flag:"🇨🇴"},
    CPV: {he:"קייפ ורדה", en:"Cape Verde", flag:"🇨🇻"},
    CRO: {he:"קרואטיה", en:"Croatia", flag:"🇭🇷"},
    CUW: {he:"קוראסאו", en:"Curaçao", flag:"🇨🇼"},
    CZE: {he:"צ'כיה", en:"Czechia", flag:"🇨🇿"},
    ECU: {he:"אקוודור", en:"Ecuador", flag:"🇪🇨"},
    EGY: {he:"מצרים", en:"Egypt", flag:"🇪🇬"},
    ENG: {he:"אנגליה", en:"England", flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿"},
    ESP: {he:"ספרד", en:"Spain", flag:"🇪🇸"},
    FRA: {he:"צרפת", en:"France", flag:"🇫🇷"},
    GER: {he:"גרמניה", en:"Germany", flag:"🇩🇪"},
    GHA: {he:"גאנה", en:"Ghana", flag:"🇬🇭"},
    HAI: {he:"האיטי", en:"Haiti", flag:"🇭🇹"},
    IRN: {he:"איראן", en:"Iran", flag:"🇮🇷"},
    IRQ: {he:"עיראק", en:"Iraq", flag:"🇮🇶"},
    JOR: {he:"ירדן", en:"Jordan", flag:"🇯🇴"},
    JPN: {he:"יפן", en:"Japan", flag:"🇯🇵"},
    KOR: {he:"קוריאה", en:"South Korea", flag:"🇰🇷"},
    KSA: {he:"סעודיה", en:"Saudi Arabia", flag:"🇸🇦"},
    MAR: {he:"מרוקו", en:"Morocco", flag:"🇲🇦"},
    MEX: {he:"מקסיקו", en:"Mexico", flag:"🇲🇽"},
    NED: {he:"הולנד", en:"Netherlands", flag:"🇳🇱"},
    NOR: {he:"נורווגיה", en:"Norway", flag:"🇳🇴"},
    NZL: {he:"ניו זילנד", en:"New Zealand", flag:"🇳🇿"},
    PAN: {he:"פנמה", en:"Panama", flag:"🇵🇦"},
    PAR: {he:"פרגוואי", en:"Paraguay", flag:"🇵🇾"},
    POR: {he:"פורטוגל", en:"Portugal", flag:"🇵🇹"},
    QAT: {he:"קטאר", en:"Qatar", flag:"🇶🇦"},
    RSA: {he:"דרום אפריקה", en:"South Africa", flag:"🇿🇦"},
    SCO: {he:"סקוטלנד", en:"Scotland", flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿"},
    SEN: {he:"סנגל", en:"Senegal", flag:"🇸🇳"},
    SUI: {he:"שוויץ", en:"Switzerland", flag:"🇨🇭"},
    SWE: {he:"שוודיה", en:"Sweden", flag:"🇸🇪"},
    TUN: {he:"תוניסיה", en:"Tunisia", flag:"🇹🇳"},
    TUR: {he:"טורקיה", en:"Türkiye", flag:"🇹🇷"},
    URU: {he:"אורוגוואי", en:"Uruguay", flag:"🇺🇾"},
    USA: {he:"ארה\"ב", en:"United States", flag:"🇺🇸"},
    UZB: {he:"אוזבקיסטן", en:"Uzbekistan", flag:"🇺🇿"}
};

var STAGE_BY_SLUG = {
  'group-stage':     'group',
  'round-of-32':     'r32',
  'round-of-16':     'r16',
  'quarterfinals':   'qf',
  'semifinals':      'sf',
  '3rd-place-match': 'third',
  'final':           'final'
};

var STAGE_HE = {
  group: 'שלב הבתים', r32: 'סיבוב 32', r16: 'שמינית גמר',
  qf: 'רבע גמר', sf: 'חצי גמר', third: 'מקום שלישי', final: 'גמר'
};
var STAGE_EN = {
  group: 'Group Stage', r32: 'Round of 32', r16: 'Round of 16',
  qf: 'Quarter-final', sf: 'Semi-final', third: '3rd Place', final: 'Final'
};

var MONTH_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
var MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DAY_HE   = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
var DAY_EN   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Israel-local time ────────────────────────────────────────────────
// Shift the instant by +3h and read UTC getters. Never uses the browser's
// timezone — a user in Berlin must still see Israeli kickoff times.
function ilParts(utcDate) {
  var d = new Date(utcDate.getTime() + IL_OFFSET_MS);
  var hh = d.getUTCHours();
  var mm = d.getUTCMinutes();
  var day = d.getUTCDate();
  var mon = d.getUTCMonth();
  return {
    hour: hh,
    time: pad(hh) + ':' + pad(mm),
    date: day + '/' + (mon + 1),
    dayKey: d.getUTCFullYear() + '-' + pad(mon + 1) + '-' + pad(day),
    dayLabelHe: DAY_HE[d.getUTCDay()] + ', ' + day + ' ' + MONTH_HE[mon],
    dayLabelEn: DAY_EN[d.getUTCDay()] + ', ' + MONTH_EN[mon] + ' ' + day
  };
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

// ESPN emits "2026-06-11T19:00Z" — no seconds. Older iOS Safari returns
// Invalid Date for that form, which would silently break every kickoff time.
function parseUTC(s) {
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?Z?$/.exec(s || '');
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
  }
  return d;   // Invalid Date — caller's guards handle it
}

// Sleep guide: how painful is this kickoff for an Israeli viewer?
function stripFor(utcDate) {
  var h = ilParts(utcDate).hour;
  if (h >= 6 && h <= 23) return 'safe';    // 06:00–23:59 — watchable
  if (h <= 1) return 'warn';               // 00:00–01:59 — late
  return 'danger';                         // 02:00–05:59 — deep night
}

// ── Flag rendering ───────────────────────────────────────────────────
// Windows has no flag-emoji font. Regional-indicator pairs (🇪🇸) degrade to the
// letters "ES", while England's tag sequence (🏴󠁧󠁢󠁥󠁮󠁧󠁿) degrades to a bare black 🏴 —
// so the two styles fail differently and England looks like the odd one out.
// Detect support once; if the platform can't draw flags, use the 3-letter code
// for every team instead of a mix of letters and black flags.
var _flagsOK = null;

function flagsSupported() {
  if (_flagsOK !== null) return _flagsOK;
  try {
    var ctx = document.createElement('canvas').getContext('2d');
    ctx.font = '20px sans-serif';
    var w = function(s) { return ctx.measureText(s).width; };
    // A real flag glyph is narrower than its two letter glyphs side by side.
    var riOK = w('🇪🇸') < (w('🇪') + w('🇸')) - 1;
    // If the tag sequence is drawn, it differs in width from a lone black flag.
    var tagOK = Math.abs(w('🏴󠁧󠁢󠁥󠁮󠁧󠁿') - w('🏴')) > 1;
    _flagsOK = riOK && tagOK;
  } catch (e) {
    _flagsOK = false;
  }
  return _flagsOK;
}

// HTML for a team's flag slot: emoji where supported, otherwise its code.
function flagFor(team) {
  if (!team || team.placeholder) return '';
  if (flagsSupported() && team.flag) return team.flag;
  if (!team.abbr) return '';
  return '<span class="fabbr">' + team.abbr + '</span>';
}

// ── Team resolution ──────────────────────────────────────────────────
// Unplayed rounds carry placeholder competitors whose displayName encodes
// the bracket link: "Quarterfinal 2 Winner" -> winner of qf[1].
var PLACEHOLDER_RE = /^(Quarterfinal|Semifinal|Round of \d+)\s+(\d+)\s+(Winner|Loser)$/;

function resolveTeam(competitor) {
  var abbr = competitor.team.abbreviation || '';
  var name = competitor.team.displayName || '';
  var known = TEAMS[abbr];
  if (known) {
    return { abbr: abbr, en: known.en, he: known.he, flag: known.flag, placeholder: false, ref: null };
  }

  var m = PLACEHOLDER_RE.exec(name);
  if (m) {
    var roundHe = m[1] === 'Quarterfinal' ? 'רבע' : (m[1] === 'Semifinal' ? 'חצי' : m[1]);
    var stageKey = m[1] === 'Quarterfinal' ? 'qf' : (m[1] === 'Semifinal' ? 'sf' : null);
    var isWin = m[3] === 'Winner';
    return {
      abbr: abbr,
      en: name,
      he: (isWin ? 'מנצחת ' : 'מפסידת ') + roundHe + ' ' + m[2],
      flag: '',
      placeholder: true,
      // 0-based index into the sibling stage array. The bracket uses this to
      // wire each match to the ones that feed it.
      ref: stageKey ? { stage: stageKey, index: parseInt(m[2], 10) - 1, winner: isWin } : null
    };
  }

  // Unknown team, no placeholder pattern. Degrade to the English name rather
  // than rendering "undefined".
  return { abbr: abbr, en: name, he: name, flag: '', placeholder: false, ref: null };
}

// ── Normalization ────────────────────────────────────────────────────
function statusOf(name) {
  if (name === 'STATUS_SCHEDULED' || name === 'STATUS_POSTPONED') return 'future';
  if (name === 'STATUS_FULL_TIME' || name === 'STATUS_FINAL_PEN' ||
      name === 'STATUS_FINAL' || name === 'STATUS_FINAL_AET') return 'past';
  // STATUS_IN_PROGRESS, STATUS_HALFTIME, and anything unrecognized mid-match
  return 'live';
}

function normalize(raw) {
  var events = (raw && raw.events) || [];
  var stages = { group: [], r32: [], r16: [], qf: [], sf: [], third: [], final: [] };
  var all = [];
  var hasLive = false;

  events.forEach(function(ev) {
    var comp = (ev.competitions && ev.competitions[0]) || null;
    if (!comp || !comp.competitors || comp.competitors.length < 2) return;

    var stage = STAGE_BY_SLUG[ev.season && ev.season.slug];
    if (!stage) return;

    var homeC = null, awayC = null;
    comp.competitors.forEach(function(c) {
      if (c.homeAway === 'home') homeC = c;
      else if (c.homeAway === 'away') awayC = c;
    });
    if (!homeC || !awayC) return;

    var utc = parseUTC(ev.date);
    if (isNaN(utc.getTime())) return;   // unparseable kickoff: drop rather than render NaN
    var st = statusOf(ev.status && ev.status.type && ev.status.type.name);
    if (st === 'live') hasLive = true;

    // A scheduled match reports score "0" — that is not a score, it is an absence.
    var score = null;
    if (st !== 'future') {
      score = { h: parseInt(homeC.score, 10) || 0, a: parseInt(awayC.score, 10) || 0 };
    }

    var pens = null;
    if (homeC.shootoutScore != null && awayC.shootoutScore != null) {
      pens = { h: homeC.shootoutScore, a: awayC.shootoutScore };
    }

    var winner = null;
    if (homeC.winner === true) winner = 'home';
    else if (awayC.winner === true) winner = 'away';

    var note = null;
    var headline = comp.notes && comp.notes[0] && comp.notes[0].headline;
    if (headline) note = { he: translateNote(headline), en: headline };

    // The only place ESPN exposes the group letter: "FIFA World Cup, Group A"
    var group = null;
    var gm = /,\s*Group\s+([A-L])$/.exec(comp.altGameNote || '');
    if (gm) group = gm[1];

    var parts = ilParts(utc);

    var match = {
      id: ev.id,
      stage: stage,
      utc: utc,
      date: parts.date,
      time: parts.time,
      dayKey: parts.dayKey,
      dayLabelHe: parts.dayLabelHe,
      dayLabelEn: parts.dayLabelEn,
      home: resolveTeam(homeC),
      away: resolveTeam(awayC),
      status: st,
      score: score,
      pens: pens,
      winner: winner,
      venue: (comp.venue && comp.venue.fullName) || '',
      group: group,
      note: note,
      strip: stripFor(utc),
      bracketIndex: 0   // assigned below, per stage
    };

    stages[stage].push(match);
    all.push(match);
  });

  // Chronological order, then bracketIndex within each stage. ESPN emits
  // knockout fixtures in bracket order, which is also chronological here.
  function byTime(a, b) { return a.utc - b.utc; }
  all.sort(byTime);
  Object.keys(stages).forEach(function(k) {
    stages[k].sort(byTime);
    stages[k].forEach(function(m, i) { m.bracketIndex = i; });
  });

  return {
    stages: stages,
    all: all,
    updatedAt: new Date(),
    stale: false,
    error: null,
    hasLive: hasLive
  };
}

function translateNote(headline) {
  // "Switzerland advance 4-3 on penalties"
  var m = /^(.+?)\s+advance[sd]?\s+(\d+)-(\d+)\s+on penalties/i.exec(headline);
  if (m) {
    var t = teamHeByEn(m[1]);
    return t + ' עלתה ' + m[2] + '-' + m[3] + ' בפנדלים';
  }
  return headline;
}

function teamHeByEn(en) {
  var keys = Object.keys(TEAMS);
  for (var i = 0; i < keys.length; i++) {
    if (TEAMS[keys[i]].en === en) return TEAMS[keys[i]].he;
  }
  return en;
}

// ── Cache ────────────────────────────────────────────────────────────
// Dates do not survive JSON. Revive them on read.
function readCache() {
  try {
    var raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || !obj.t || !obj.fetchedAt) return null;
    reviveDates(obj.t);
    obj.t.updatedAt = new Date(obj.t.updatedAt);
    return { t: obj.t, fetchedAt: obj.fetchedAt };
  } catch (e) {
    return null;
  }
}

function reviveDates(t) {
  t.all.forEach(function(m) { m.utc = new Date(m.utc); });
  // stages hold references into the same objects only if we rebuild them;
  // after JSON they are separate copies, so revive both.
  Object.keys(t.stages).forEach(function(k) {
    t.stages[k].forEach(function(m) { m.utc = new Date(m.utc); });
  });
}

function writeCache(t) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ t: t, fetchedAt: Date.now() }));
  } catch (e) {
    // quota exceeded or private mode — caching is an optimization, not a requirement
  }
}

function cacheIsFresh(entry) {
  if (!entry) return false;
  var ttl = entry.t.hasLive ? TTL_LIVE : TTL_IDLE;
  return (Date.now() - entry.fetchedAt) < ttl;
}

// ── Public API ───────────────────────────────────────────────────────
// load(cb) -> cb(err, tournament). Never throws, never silently fakes success.
//   fresh cache        -> cb(null, t)
//   network ok         -> cb(null, t)
//   network fails +cache -> cb(null, t) with t.stale = true, t.error set
//   network fails, no cache -> cb(err, null)
function load(cb, opts) {
  opts = opts || {};
  var cached = readCache();

  if (!opts.force && cacheIsFresh(cached)) {
    cb(null, cached.t);
    return;
  }

  fetch(WC.URL, { cache: 'no-store' })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(raw) {
      var t = normalize(raw);
      if (!t.all.length) throw new Error('empty response');
      writeCache(t);
      cb(null, t);
    })
    .catch(function(err) {
      var reason = (err && err.message) || 'network error';
      if (cached) {
        cached.t.stale = true;
        cached.t.error = reason;
        cb(null, cached.t);
      } else {
        cb(new Error(reason), null);
      }
    });
}

// ── Derived helpers used by more than one renderer ────────────────────

// Which stage is "now"? The one with a match today; else the next one with an
// unplayed match; else the last stage of the tournament.
function currentStage(t, now) {
  now = now || new Date();
  var todayKey = ilParts(now).dayKey;
  var order = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];
  var i, s, ms, j;

  for (i = 0; i < order.length; i++) {
    ms = t.stages[order[i]];
    for (j = 0; j < ms.length; j++) {
      if (ms[j].dayKey === todayKey) return order[i];
    }
  }
  for (i = 0; i < order.length; i++) {
    ms = t.stages[order[i]];
    for (j = 0; j < ms.length; j++) {
      if (ms[j].status !== 'past') return order[i];
    }
  }
  return 'final';
}

function upcoming(t) {
  return t.all.filter(function(m) { return m.status !== 'past'; });
}

function liveMatches(t) {
  return t.all.filter(function(m) { return m.status === 'live'; });
}

// Resolve a placeholder competitor to the match it points at.
// "Quarterfinal 2 Winner" -> t.stages.qf[1]
function refMatch(t, team) {
  if (!team || !team.ref) return null;
  var arr = t.stages[team.ref.stage];
  return (arr && arr[team.ref.index]) || null;
}

window.WC = {
  URL: URL,
  TEAMS: TEAMS,
  STAGE_HE: STAGE_HE,
  STAGE_EN: STAGE_EN,
  load: load,
  ilParts: ilParts,
  stripFor: stripFor,
  flagsSupported: flagsSupported,
  flagFor: flagFor,
  currentStage: currentStage,
  upcoming: upcoming,
  liveMatches: liveMatches,
  refMatch: refMatch,
  _normalize: normalize   // exposed for tests
};

})();
