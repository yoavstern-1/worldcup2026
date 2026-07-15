// ══════════════════════════════════════════════════════
// data.js — single source of truth for the tournament
//
// One request to ESPN returns all 104 matches tagged by stage, with winners,
// shootout scores, and placeholder teams for rounds not yet decided
// ("Quarterfinal 2 Winner"). Everything else in the app reads this model.
// Nothing scrapes the DOM.
//
// The same payload also carries per-match play details (every goal with scorer
// and minute, every card) and team statistics (possession, shots, corners,
// fouls). Those feed the Data tab; they are normalized here, never re-fetched.
// ══════════════════════════════════════════════════════
(function() {

var URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'
        + '?dates=20260611-20260719&limit=300';

var CACHE_KEY = 'wc26:v3';   // bump when the normalized shape or labels change
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

// ── Venue names ──────────────────────────────────────────────────────
// ESPN returns the commercial name in English. Hebrew mode must not show a
// Latin string, so every one of the 16 WC26 venues has a Hebrew rendering with
// its city. Keyed on the exact fullName ESPN emits (Azteca now reports as
// "Estadio Banorte"); unknown venues fall back to the English name.
var VENUE_HE = {
  'MetLife Stadium':                'מטלייף · ניו ג׳רזי',
  'AT&T Stadium':                   'אצטדיון דאלאס',
  'Mercedes-Benz Stadium':          'מרצדס-בנץ · אטלנטה',
  'NRG Stadium':                    'אצטדיון יוסטון',
  'GEHA Field at Arrowhead Stadium':'ארוהד · קנזס סיטי',
  'Arrowhead Stadium':              'ארוהד · קנזס סיטי',
  'Lumen Field':                    'לומן פילד · סיאטל',
  "Levi's Stadium":                 'ליוויס · סן פרנסיסקו',
  'SoFi Stadium':                   'סופיי · לוס אנג׳לס',
  'Lincoln Financial Field':        'לינקולן פילד · פילדלפיה',
  'Gillette Stadium':               'ג׳ילט · בוסטון',
  'Hard Rock Stadium':              'הארד רוק · מיאמי',
  'BMO Field':                      'בי-אם-או פילד · טורונטו',
  'BC Place':                       'בי-סי פלייס · ונקובר',
  'Estadio Banorte':                'אצטקה · מקסיקו סיטי',
  'Estadio Azteca':                 'אצטקה · מקסיקו סיטי',
  'Estadio BBVA':                   'אצטדיון מונטריי',
  'Estadio Akron':                  'אקרון · גוודלחרה'
};

// Hebrew spellings for the players who actually appear on the scorer board.
// Only the leaders are ever rendered, so a partial map is enough; anyone
// missing falls back to the Latin name ESPN gives.
var PLAYER_HE = {
  'Kylian Mbappé':      'קיליאן אמבפה',
  'Lionel Messi':       'ליונל מסי',
  'Erling Haaland':     'ארלינג הולאנד',
  'Harry Kane':         'הארי קיין',
  'Jude Bellingham':    'ג׳וד בלינגהאם',
  'Ousmane Dembélé':    'עוסמאן דמבלה',
  'Julián Quiñones':    'חוליאן קיניונס',
  'Vinícius Júnior':    'ויניסיוס ז׳וניור',
  'Mikel Oyarzabal':    'מיקל אויארסבאל',
  'Ismaïla Sarr':       'איסמעילה סאר',
  'Raúl Jiménez':       'ראול חימנס',
  'Folarin Balogun':    'פולארין בלוגון',
  'Ismael Saibari':     'איסמעיל סאיברי',
  'Kai Havertz':        'קאי הברץ',
  'Deniz Undav':        'דניז אונדב',
  'Elijah Just':        'אלייז׳ה ג׳אסט',
  'Yoane Wissa':        'יואן ויסה',
  'Johan Manzambi':     'יוהאן מנזמבי',
  'Jonathan David':     'ג׳ונתן דיוויד',
  'Matheus Cunha':      'מתאוס קונה',
  'Lamine Yamal':       'לאמין ימאל',
  'Cristiano Ronaldo':  'כריסטיאנו רונאלדו',
  'Bukayo Saka':        'בוקאיו סאקה',
  'Rodrygo':            'רודריגו',
  'Lautaro Martínez':   'לאוטרו מרטינס',
  'Julián Álvarez':     'חוליאן אלוורס',
  'Michael Olise':      'מייקל אוליסה',
  'Florian Wirtz':      'פלוריאן וירץ',
  'Jamal Musiala':      'ג׳מאל מוסיאלה',
  'Nico Williams':      'ניקו וויאמס',
  'Pedri':              'פדרי',
  'Alexis Mac Allister':'אלקסיס מק אליסטר',
  'Dan Ndoye':          'דן נדואה'
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
// Detect support once; if the platform can't draw flags there is nothing to
// show. The old 3-letter chip is gone: in Hebrew it printed a Latin code next
// to every Hebrew team name, and the name alone identifies the team anyway.
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

// HTML for a team's flag slot: the emoji where the platform can draw it,
// nothing at all where it cannot.
function flagFor(team) {
  if (!team || team.placeholder) return '';
  if (flagsSupported() && team.flag) return team.flag;
  return '';
}

// ── Team resolution ──────────────────────────────────────────────────
// Unplayed rounds carry placeholder competitors whose displayName encodes
// the bracket link: "Quarterfinal 2 Winner" -> winner of qf[1].
var PLACEHOLDER_RE = /^(Quarterfinal|Semifinal|Round of \d+)\s+(\d+)\s+(Winner|Loser)$/;

function resolveTeam(competitor) {
  var abbr = competitor.team.abbreviation || '';
  var name = competitor.team.displayName || '';
  var id = competitor.team.id || '';
  var known = TEAMS[abbr];
  if (known) {
    return { abbr: abbr, id: id, en: known.en, he: known.he, flag: known.flag, placeholder: false, ref: null };
  }

  var m = PLACEHOLDER_RE.exec(name);
  if (m) {
    var roundHe = m[1] === 'Quarterfinal' ? 'רבע' : (m[1] === 'Semifinal' ? 'חצי' : m[1]);
    var stageKey = m[1] === 'Quarterfinal' ? 'qf' : (m[1] === 'Semifinal' ? 'sf' : null);
    var isWin = m[3] === 'Winner';
    return {
      abbr: abbr,
      id: id,
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
  return { abbr: abbr, id: id, en: name, he: name, flag: '', placeholder: false, ref: null };
}

// ── Normalization ────────────────────────────────────────────────────
function statusOf(name) {
  if (name === 'STATUS_SCHEDULED' || name === 'STATUS_POSTPONED') return 'future';
  if (name === 'STATUS_FULL_TIME' || name === 'STATUS_FINAL_PEN' ||
      name === 'STATUS_FINAL' || name === 'STATUS_FINAL_AET') return 'past';
  // STATUS_IN_PROGRESS, STATUS_HALFTIME, and anything unrecognized mid-match
  return 'live';
}

var STAT_KEYS = {
  possessionPct: 'poss', totalShots: 'shots', shotsOnTarget: 'sog',
  wonCorners: 'corners', foulsCommitted: 'fouls'
};

function teamStats(competitor) {
  var out = null;
  (competitor.statistics || []).forEach(function(s) {
    var key = STAT_KEYS[s.name];
    if (!key) return;
    var v = parseInt(s.displayValue, 10);
    if (isNaN(v)) return;
    if (!out) out = {};
    out[key] = v;
  });
  return out;
}

// Every goal and card, flattened to the smallest shape that survives a JSON
// round-trip into localStorage. Shootout kicks are excluded — they are already
// carried as m.pens and would otherwise double-count as goals.
function playEvents(comp, homeId, awayId) {
  var out = [];
  (comp.details || []).forEach(function(d) {
    if (d.shootout) return;
    var side = String(d.team && d.team.id) === String(homeId) ? 'home'
             : (String(d.team && d.team.id) === String(awayId) ? 'away' : null);
    if (!side) return;
    var kind = null;
    if (d.scoringPlay) kind = d.ownGoal ? 'og' : (d.penaltyKick ? 'pk' : 'goal');
    else if (d.redCard) kind = 'red';
    else if (d.yellowCard) kind = 'yellow';
    if (!kind) return;
    var who = (d.athletesInvolved || [])[0];
    out.push({
      kind: kind,
      side: side,
      min: (d.clock && d.clock.displayValue) || '',
      sec: (d.clock && d.clock.value) || 0,
      player: (who && who.displayName) || ''
    });
  });
  out.sort(function(a, b) { return a.sec - b.sec; });
  return out;
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
    var stObj = (ev.status || {});
    var stType = stObj.type || {};
    var st = statusOf(stType.name);
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
    var home = resolveTeam(homeC);
    var away = resolveTeam(awayC);

    var match = {
      id: ev.id,
      stage: stage,
      utc: utc,
      date: parts.date,
      time: parts.time,
      dayKey: parts.dayKey,
      dayLabelHe: parts.dayLabelHe,
      dayLabelEn: parts.dayLabelEn,
      home: home,
      away: away,
      status: st,
      // Live clock, straight from ESPN. `clock` is seconds elapsed in the match
      // (2700 at half-time, 7200 at the end of extra time); `period` is 1-2 for
      // regulation, 3-4 for extra time, 5 for a shootout.
      statusName: stType.name || '',
      period: stObj.period || 0,
      clock: stObj.clock || 0,
      displayClock: stObj.displayClock || '',
      score: score,
      pens: pens,
      winner: winner,
      venue: (comp.venue && comp.venue.fullName) || '',
      group: group,
      note: note,
      strip: stripFor(utc),
      events: st === 'future' ? [] : playEvents(comp, home.id, away.id),
      stats: st === 'future' ? null : { home: teamStats(homeC), away: teamStats(awayC) },
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

// ── Localized names ──────────────────────────────────────────────────
function venueName(m, he) {
  if (!m || !m.venue) return '';
  if (!he) return m.venue;
  return VENUE_HE[m.venue] || m.venue;
}

function playerName(name, he) {
  if (!name) return '';
  return he ? (PLAYER_HE[name] || name) : name;
}

// ── Live clock ───────────────────────────────────────────────────────
// What phase of the match is this, and what minute is it in? The minute is
// extrapolated from ESPN's clock plus the time since we fetched it, so it
// ticks between the 60-second refreshes instead of sitting frozen.
// Deliberately only five states the user ever sees. There is no "הפסקה" (the break
// IS the half, and "מחצית" is what the scoreboard says) and no "סוף הארכה" — a break
// before penalties is still extra time as far as the card is concerned. Stoppage time
// gets its own label, because "90+3'" alone does not read as added time to everyone.
var PHASE = {
  ht:    { he: 'מחצית',      en: 'Halftime' },
  pens:  { he: 'פנדלים',     en: 'Pens' },
  stop:  { he: 'תוספת זמן',  en: 'Stoppage' },
  et:    { he: 'הארכה',      en: 'Extra time' },
  h1:    { he: 'מחצית 1',    en: '1st half' },
  h2:    { he: 'מחצית 2',    en: '2nd half' },
  live:  { he: 'משחק חי',    en: 'Live' }
};

function livePhase(m) {
  var n = m.statusName || '';
  var p = m.period || 0;
  if (n.indexOf('HALFTIME') !== -1) return PHASE.ht;
  if (n.indexOf('SHOOTOUT') !== -1 || p >= 5) return PHASE.pens;
  // End of regulation and end of extra time are both "we are in / heading into
  // extra time", not states of their own.
  if (n.indexOf('END_OF_EXTRATIME') !== -1) return PHASE.et;
  if (n.indexOf('END_OF_REGULATION') !== -1 || n.indexOf('END_OF_PERIOD') !== -1) return PHASE.et;
  if (p === 3 || p === 4) return PHASE.et;
  // Past the period's cap with the clock still running = added time.
  if (inStoppage(m)) return PHASE.stop;
  if (p === 1) return PHASE.h1;
  if (p === 2) return PHASE.h2;
  return PHASE.live;
}

// Raw clock only — no drift extrapolation. A label must not flicker between
// "2nd half" and "Stoppage" on the strength of a few extrapolated seconds.
function inStoppage(m) {
  if (!clockRunning(m)) return false;
  var cap = PERIOD_CAP[m.period];
  if (!cap) return false;
  return Math.floor((m.clock || 0) / 60) + 1 > cap;
}

// The clock does not advance during half-time, the break before extra time, or
// a shootout — extrapolating through those would invent minutes that never ran.
function clockRunning(m) {
  var n = m.statusName || '';
  if (n.indexOf('HALFTIME') !== -1 || n.indexOf('SHOOTOUT') !== -1) return false;
  if (n.indexOf('END_OF_') !== -1) return false;
  return (m.period || 0) >= 1 && (m.period || 0) <= 4;
}

// Cap of each period, so a 46th minute in the first half prints as 45+1 rather
// than running away to 47, 48… while the broadcast is still in stoppage time.
var PERIOD_CAP = { 1: 45, 2: 90, 3: 105, 4: 120 };

// Empty during half-time, the break before extra time and a shootout: there is
// no minute to show, and printing the frozen one ("45+1'" through the whole
// interval) reads as a stuck clock. The phase label carries those on its own.
function liveMinute(m, fetchedAt) {
  if (!m || m.status !== 'live') return '';
  if (!clockRunning(m)) return '';
  var sec = m.clock || 0;
  if (clockRunning(m) && fetchedAt) {
    var drift = (Date.now() - fetchedAt) / 1000;
    if (drift > 0 && drift < 900) sec += drift;   // ignore a wildly stale cache
  }
  var minute = Math.floor(sec / 60) + 1;
  var cap = PERIOD_CAP[m.period];
  if (!cap) return m.displayClock || '';
  if (minute > cap) return cap + "+" + (minute - cap) + "'";
  return minute + "'";
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
    obj.t.fetchedAt = obj.fetchedAt;
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
//
// cb is fired from a setTimeout, OUTSIDE the promise chain, and settle() fires it at most
// once. Both matter. Calling cb() inside .then() put the caller's renderer inside the
// chain, so an exception THERE was caught by the .catch() below and reported as a network
// failure: a ReferenceError in the render path came back as "could not refresh", and the
// .catch() then re-entered cb with the cached tournament, which threw again — the second
// throw escaped as an unhandled rejection and the refresh button spun for ever. A render
// bug must surface as a render bug.
function load(cb, opts) {
  opts = opts || {};
  var cached = readCache();
  var settled = false;

  function settle(err, t) {
    if (settled) return;
    settled = true;
    setTimeout(function() { cb(err, t); }, 0);
  }

  if (!opts.force && cacheIsFresh(cached)) {
    settle(null, cached.t);
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
      t.fetchedAt = Date.now();
      writeCache(t);
      settle(null, t);
    })
    .catch(function(err) {
      var reason = (err && err.message) || 'network error';
      if (cached) {
        cached.t.stale = true;
        cached.t.error = reason;
        settle(null, cached.t);
      } else {
        settle(new Error(reason), null);
      }
    });
}

// ── Derived helpers used by more than one renderer ────────────────────

// Which stage is "now"?
//   1. one with a live match
//   2. one with a match still to come today
//   3. the first with any unplayed match  ("up next")
//   4. the final
//
// Note what is deliberately NOT here: "a stage with any match today". A stage
// whose last fixture kicked off this morning and is already over is finished —
// on the evening of the last quarter-final the site should be pointing at the
// semi-finals, not still sitting on a round that has nothing left to play.
function currentStage(t, now) {
  now = now || new Date();
  var todayKey = ilParts(now).dayKey;
  var order = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];
  var i, ms, j;

  for (i = 0; i < order.length; i++) {
    ms = t.stages[order[i]];
    for (j = 0; j < ms.length; j++) {
      if (ms[j].status === 'live') return order[i];
    }
  }
  for (i = 0; i < order.length; i++) {
    ms = t.stages[order[i]];
    for (j = 0; j < ms.length; j++) {
      if (ms[j].dayKey === todayKey && ms[j].status !== 'past') return order[i];
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

// Where does a stage stand right now? Drives the sub-heading on every tab, so
// "Quarter-finals start today!" cannot survive into the following week.
// -> { state: 'done'|'live'|'today'|'next'|'future', from, to, played, total }
function stageState(t, key, now) {
  now = now || new Date();
  var ms = t.stages[key] || [];
  if (!ms.length) return { state: 'future', from: '', to: '', played: 0, total: 0 };
  var todayKey = ilParts(now).dayKey;
  var played = 0, live = 0, today = 0;
  ms.forEach(function(m) {
    if (m.status === 'past') played++;
    if (m.status === 'live') live++;
    if (m.dayKey === todayKey && m.status !== 'past') today++;
  });
  var state;
  if (live) state = 'live';
  else if (played === ms.length) state = 'done';
  else if (today) state = 'today';
  else state = 'future';

  // The one stage that is next up gets a distinct label from stages further out.
  if (state === 'future' && currentStage(t, now) === key) state = 'next';

  return {
    state: state,
    from: ms[0].date,
    to: ms[ms.length - 1].date,
    fromDayHe: ms[0].dayLabelHe,
    played: played,
    total: ms.length
  };
}

// ── Tournament statistics ────────────────────────────────────────────
// Everything here is derived from matches already in the model. It is computed
// once per render, not fetched.
// Did the side that won this match trail at any point in it? Replay the goal events
// in order and watch for the eventual winner being behind. Shootout kicks are skipped
// -- they are recorded as events too, and counting them would make every shootout
// look like a comeback. This is the one genuinely narrative stat a score-and-events
// feed can produce that the big sites do not headline, which is why it replaces
// "clean sheets" (a binary that says nothing anyone wants to read).
function comeback(m) {
  if (!m.score || m.score.h === m.score.a) return false;   // a draw cannot be a comeback
  var winner = m.score.h > m.score.a ? 'home' : 'away';
  // playEvents() already drops shootout kicks, so every goal here is a real one.
  // ESPN credits an own goal to the side that BENEFITS from it, not the side that put
  // it in — checked against all 14 own-goal matches in this tournament, every one of
  // which reconstructs its final score only if `side` is taken at face value.
  var goals = (m.events || []).filter(function(e) {
    return e.kind === 'goal' || e.kind === 'pk' || e.kind === 'og';
  }).sort(function(a, b) { return (a.sec || 0) - (b.sec || 0); });

  var h = 0, a = 0, trailed = false;
  for (var i = 0; i < goals.length; i++) {
    if (goals[i].side === 'home') h++; else a++;
    if ((winner === 'home' ? h - a : a - h) < 0) trailed = true;
  }
  // Only trust the replay if it reconstructs the final score. A dropped event would
  // otherwise invent or hide a comeback, and a wrong number here is worse than none.
  if (h !== m.score.h || a !== m.score.a) return false;
  return trailed;
}

// 15-minute block a goal fell in. Anything past 90 is its own bucket rather than being
// folded into 76-90: stoppage-time goals are the story, not a rounding error.
//
// Read the DISPLAY clock ("45'+5'"), not e.sec. ESPN caps sec at 2700 for every first-half
// stoppage-time goal, so `sec` alone said minute 46 and filed ten 45'+X goals — Havertz,
// David and eight others — into the SECOND half. The buckets still summed to the headline,
// which is exactly why a sum check never caught it: the goals were not lost, they were
// filed under the wrong quarter of an hour. A goal in 45'+5' is a first-half goal.
function bucketOf(e) {
  var disp = (e && e.min) || '';
  var mm = disp.match(/^(\d+)/);
  if (mm) {
    var base = parseInt(mm[1], 10);
    var stoppage = disp.indexOf('+') !== -1;
    if (base > 90) return 6;                    // extra time
    if (base === 90 && stoppage) return 6;      // 90'+X
    if (base === 45 && stoppage) return 2;      // 45'+X is the FIRST half
    return Math.min(5, Math.floor((Math.max(1, base) - 1) / 15));
  }
  // No display clock: fall back to the capped seconds. Wrong for 45'+X, but it is the only
  // thing left, and a bucket is better than dropping the goal out of the chart entirely.
  var min = Math.floor((e && e.sec || 0) / 60) + 1;
  if (min > 90) return 6;
  return Math.min(5, Math.floor((min - 1) / 15));
}

// Which side scored the opening goal, or null if the match had none. Own goals count
// for the side they benefit, same convention as everywhere else here.
function firstScorer(m) {
  var goals = (m.events || []).filter(function(e) {
    return e.kind === 'goal' || e.kind === 'pk' || e.kind === 'og';
  }).sort(function(a, b) { return (a.sec || 0) - (b.sec || 0); });
  return goals.length ? goals[0].side : null;
}

function tournamentStats(t) {
  var played = t.all.filter(function(m) { return m.status !== 'future' && m.score; });

  var s = {
    played: played.length,
    total: t.all.length,
    goals: 0,
    avg: 0,
    homeWins: 0, awayWins: 0, draws: 0,
    cleanSheets: 0,   // still aggregated per team (best-defence board); no longer a headline
    comebacks: 0,
    shootouts: 0,
    extraTime: 0,
    penaltyGoals: 0,
    ownGoals: 0,
    yellow: 0,
    red: 0,
    oneGoalGames: 0,
    goalless: 0,
    biggest: null,
    highest: null,
    scorers: [],
    teams: [],       // per-team table
    byStage: [],     // goals per stage, for the trend row
    lateGoals: 0,    // goals from the 80th minute on (incl. stoppage)
    // "The side that scored first went on to win N% of the time" — the single most
    // predictive number a fixtures+events feed holds, and it replaces "home-side wins",
    // which in a neutral-venue tournament measures nothing at all.
    firstGoalGames: 0,
    firstGoalWon: 0,
    byMinute: [],    // goals per 15-minute block — WHEN a World Cup is decided
    multiGoal: []    // players who scored 2+ in a single match
  };

  var minuteBuckets = [0, 0, 0, 0, 0, 0, 0];   // 1-15,16-30,31-45,46-60,61-75,76-90,90+
  var multi = {};                               // player|matchId -> {name, team, n, m}

  var team = {};   // abbr -> aggregate
  function slot(tm) {
    if (!team[tm.abbr]) {
      team[tm.abbr] = { abbr: tm.abbr, he: tm.he, en: tm.en, flag: tm.flag,
                        p: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, cs: 0,
                        shots: 0, sog: 0, poss: 0, possN: 0,
                        // statsN: matches this team actually had a statistics[] block for.
                        // ESPN omits it on some fixtures, and a shots-per-goal ratio that
                        // divides a full goal count by a partial shot count is a lie.
                        statsN: 0,
                        yellow: 0, red: 0, comebacks: 0 };
    }
    return team[tm.abbr];
  }

  var scorer = {};
  var stageGoals = {};

  played.forEach(function(m) {
    var h = m.score.h, a = m.score.a;
    s.goals += h + a;
    stageGoals[m.stage] = (stageGoals[m.stage] || 0) + h + a;

    if (h === a) s.draws++;
    else if (h > a) s.homeWins++;
    else s.awayWins++;

    if (Math.abs(h - a) === 1) s.oneGoalGames++;
    if (h + a === 0) s.goalless++;
    if (h === 0 || a === 0) s.cleanSheets++;
    if (m.pens) s.shootouts++;
    if (m.statusName === 'STATUS_FINAL_AET' || (m.period || 0) >= 4) s.extraTime++;

    var diff = Math.abs(h - a);
    if (!s.biggest || diff > s.biggest.diff) s.biggest = { diff: diff, m: m };
    if (!s.highest || (h + a) > s.highest.total) s.highest = { total: h + a, m: m };

    if (!m.home.placeholder && !m.away.placeholder) {
      var th = slot(m.home), ta = slot(m.away);
      th.p++; ta.p++;
      th.gf += h; th.ga += a;
      ta.gf += a; ta.ga += h;
      if (h > a) { th.w++; ta.l++; }
      else if (a > h) { ta.w++; th.l++; }
      else { th.d++; ta.d++; }
      if (a === 0) th.cs++;
      if (h === 0) ta.cs++;
      if (m.stats) {
        ['home', 'away'].forEach(function(side) {
          var st = m.stats[side];
          if (!st) return;
          var agg = side === 'home' ? th : ta;
          if (st.shots != null) { agg.shots += st.shots; agg.statsN++; }
          if (st.sog != null) agg.sog += st.sog;
          if (st.poss != null) { agg.poss += st.poss; agg.possN++; }
        });
      }
    }

    var real = !m.home.placeholder && !m.away.placeholder;

    (m.events || []).forEach(function(e) {
      var tm = e.side === 'home' ? m.home : m.away;
      if (e.kind === 'yellow') { s.yellow++; if (real) slot(tm).yellow++; return; }
      if (e.kind === 'red')    { s.red++;    if (real) slot(tm).red++;    return; }

      // Everything from here down is a goal. Count it in the minute buckets and the
      // late-goal tally BEFORE the own-goal branch returns: an own goal has no scorer
      // to credit, but it is still a goal that hit the net in a particular minute, and
      // leaving it out made the "when goals are scored" chart sum to 278 while the
      // headline above it said 292.
      minuteBuckets[bucketOf(e)]++;
      if (e.sec >= 79 * 60) s.lateGoals++;

      if (e.kind === 'pk') s.penaltyGoals++;
      if (e.kind === 'og') { s.ownGoals++; return; }   // no scorer to credit

      if (!e.player) return;
      if (!scorer[e.player]) scorer[e.player] = { name: e.player, goals: 0, team: tm };
      scorer[e.player].goals++;

      var mk = e.player + '|' + m.id;
      if (!multi[mk]) multi[mk] = { name: e.player, team: tm, n: 0, m: m };
      multi[mk].n++;
    });

    if (comeback(m)) {
      s.comebacks++;
      if (real) slot(m.score.h > m.score.a ? m.home : m.away).comebacks++;
    }

    // Did scoring first actually win the match?
    var first = firstScorer(m);
    if (first && m.score.h !== m.score.a) {
      s.firstGoalGames++;
      var won = m.score.h > m.score.a ? 'home' : 'away';
      if (first === won) s.firstGoalWon++;
    }
  });

  var BLOCKS = ['1-15', '16-30', '31-45', '46-60', '61-75', '76-90', '90+'];
  var peakBucket = Math.max.apply(null, minuteBuckets) || 1;
  s.byMinute = minuteBuckets.map(function(n, i) {
    return { block: BLOCKS[i], goals: n, ratio: n / peakBucket };
  });

  s.multiGoal = Object.keys(multi).map(function(k) { return multi[k]; })
    .filter(function(x) { return x.n >= 2; })
    .sort(function(a, b) { return b.n - a.n || (b.m.utc - a.m.utc); });

  s.avg = s.played ? (s.goals / s.played) : 0;

  s.scorers = Object.keys(scorer).map(function(k) { return scorer[k]; })
    .sort(function(a, b) { return b.goals - a.goals || a.name.localeCompare(b.name); });

  s.teams = Object.keys(team).map(function(k) { return team[k]; });

  var ORDER = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];
  s.byStage = ORDER.filter(function(k) { return stageGoals[k]; }).map(function(k) {
    var n = (t.stages[k] || []).filter(function(m) { return m.status !== 'future'; }).length;
    return { stage: k, goals: stageGoals[k], matches: n, avg: n ? stageGoals[k] / n : 0 };
  });

  return s;
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
  stageState: stageState,
  upcoming: upcoming,
  liveMatches: liveMatches,
  livePhase: livePhase,
  liveMinute: liveMinute,
  venueName: venueName,
  playerName: playerName,
  refMatch: refMatch,
  tournamentStats: tournamentStats,
  _normalize: normalize   // exposed for tests
};

})();
