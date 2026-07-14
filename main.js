// ── RIPPLE on every interactive element ──
function attachRipple(el){
  el.addEventListener('click', function(e){
    var ink = document.createElement('span');
    ink.className = 'ripple-ink';
    var rect = el.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    ink.style.width = ink.style.height = size + 'px';
    ink.style.left = (e.clientX - rect.left - size/2) + 'px';
    ink.style.top = (e.clientY - rect.top - size/2) + 'px';
    el.appendChild(ink);
    setTimeout(function(){ ink.remove(); }, 600);
  });
}
document.querySelectorAll('.side-btn,.drawer-item,.set-opt,.mc,.rc').forEach(attachRipple);

// ── DRAWER ──
var activeDrawer = null;
var drawerTimer = null;
function toggleDrawer(which){
  closePanel();
  if(activeDrawer === which){ closeDrawer(); return; }
  var wasOpen = activeDrawer !== null;
  closeDrawer();
  clearTimeout(drawerTimer);
  function _open(){
    activeDrawer = which;
    document.getElementById('overlay').classList.add('open');
    document.getElementById('drawerMatches').classList.add('open');
    document.getElementById('btnMatches').classList.add('active');
  }
  if(wasOpen){ drawerTimer = setTimeout(_open, 440); } else { _open(); }
}
function closeDrawer(){
  activeDrawer = null;
  clearTimeout(drawerTimer);
  document.getElementById('overlay').classList.remove('open');
  document.getElementById('drawerMatches').classList.remove('open');
  document.getElementById('btnMatches').classList.remove('active');
}

// ── STAGE SWITCH ──
function goStage(id, el){
  stageWasChosen = true;
  document.querySelectorAll('.stage').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.drawer-item').forEach(function(d){ d.classList.remove('active'); });
  var st = document.getElementById('stage-'+id);
  if (st) st.classList.add('active');
  if(el) el.classList.add('active');
  setTimeout(function(){ closeDrawer(); window.scrollTo({top:0,behavior:'smooth'}); }, 220);
}

// ── LANGUAGE ──
var curLang = 'he';
function isHe() { return curLang === 'he'; }
function setLang(lang){
  curLang = lang;
  var html = document.documentElement;
  html.setAttribute('lang', lang);
  html.setAttribute('dir', lang==='he' ? 'rtl' : 'ltr');
  document.querySelectorAll('[data-he]').forEach(function(el){
    var val = el.getAttribute('data-'+lang);
    if(val !== null) el.textContent = val;
  });
  // placeholders aren't textContent — swap them separately
  document.querySelectorAll('[data-ph-he]').forEach(function(el){
    var val = el.getAttribute('data-ph-'+lang);
    if(val !== null) el.setAttribute('placeholder', val);
  });
  document.getElementById('langHe').classList.toggle('active', lang==='he');
  document.getElementById('langEn').classList.toggle('active', lang==='en');
}

// ── THEME ──
function setTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeDark').classList.toggle('active', theme==='dark');
  document.getElementById('themeLight').classList.toggle('active', theme==='light');
  var btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}

// ── SIDE PANEL ──
var activePanel = null;
function openPanel(which, btn) {
  var panel = document.getElementById('sidePanel');
  if (activePanel === which) { closePanel(); return; }
  activePanel = which;
  ['panelLang','panelTheme'].forEach(function(id){
    document.getElementById(id).style.display =
      (id === 'panel' + which.charAt(0).toUpperCase() + which.slice(1)) ? '' : 'none';
  });
  var rect = btn.getBoundingClientRect();
  var isRTL = document.documentElement.dir === 'rtl';
  panel.style.top = rect.top + 'px';
  if (isRTL) {
    panel.style.right = (window.innerWidth - rect.left + 8) + 'px';
    panel.style.left = 'auto';
  } else {
    panel.style.left = (rect.right + 8) + 'px';
    panel.style.right = 'auto';
  }
  requestAnimationFrame(function(){ panel.classList.add('open'); });
}
function closePanel() {
  document.getElementById('sidePanel').classList.remove('open');
  activePanel = null;
}
document.addEventListener('click', function(e) {
  if (activePanel && !e.target.closest('.side-item') && !e.target.closest('.side-panel')) closePanel();
});

// ── REFRESH TOOLTIP ──
var refreshTipText = '';
function showRefreshTip(btn) {
  var tip = document.getElementById('refreshTip');
  if (!tip || !refreshTipText) return;
  var rect = btn.getBoundingClientRect();
  var isRTL = document.documentElement.dir === 'rtl';
  tip.textContent = refreshTipText;
  tip.style.top = (rect.top + rect.height/2 - 16) + 'px';
  if (isRTL) {
    tip.style.right = (window.innerWidth - rect.left + 8) + 'px';
    tip.style.left = 'auto';
  } else {
    tip.style.left = (rect.right + 8) + 'px';
    tip.style.right = 'auto';
  }
  tip.style.opacity = '1';
}
function hideRefreshTip() {
  var tip = document.getElementById('refreshTip');
  if (tip) tip.style.opacity = '0';
}

document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ closeDrawer(); closeChat(); } });

// ── LIVE DATA (ESPN public API) ──
var liveRefreshTimer = null;
var liveClockTimer = null;

var SYNC_ICON = { live: '🟡', stale: '⚠️', error: '⚠️', ok: '↺' };

function setSyncBar(state, text) {
  var btn = document.getElementById('btnRefresh');
  refreshTipText = text;
  if (state === 'loading') {
    if (btn) btn.classList.add('spinning');
    return;
  }
  if (!btn) return;
  btn.classList.remove('spinning');
  btn.textContent = SYNC_ICON[state] || SYNC_ICON.ok;
}

// ── TOURNAMENT LOAD + RENDER ─────────────────────────────────────────
var TOURNAMENT = null;

function loadTournament(force) {
  setSyncBar('loading', isHe() ? 'מעדכן נתונים...' : 'Fetching live data...');
  WC.load(function(err, t) {
    if (err) { renderHardError(err); return; }
    TOURNAMENT = t;
    renderAll(t);
    reportSync(t);
    clearTimeout(liveRefreshTimer);
    liveRefreshTimer = setTimeout(function(){ loadTournament(true); }, t.hasLive ? 60000 : 300000);
  }, { force: !!force });
}

// The old code called this "ok" even when all four fetches had 404d and zero
// events were applied. A timestamp the user can trust, or none at all.
function reportSync(t) {
  if (t.stale) {
    setSyncBar('stale', isHe()
      ? 'נתונים ישנים · לא הצלחנו להתעדכן'
      : 'Stale data · could not refresh');
    return;
  }
  var timeStr = t.updatedAt.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
  if (t.hasLive) {
    setSyncBar('live', (isHe() ? 'משחק חי · עדכון: ' : 'Live now · Updated: ') + timeStr);
  } else {
    setSyncBar('ok', (isHe() ? 'עודכן: ' : 'Updated: ') + timeStr);
  }
}

function renderHardError(err) {
  setSyncBar('error', isHe() ? 'שגיאה בטעינת נתונים' : 'Failed to load data');
  var active = document.querySelector('.stage.active') || document.getElementById('stage-qf');
  if (!active) return;
  var box = active.querySelector('.day-block') || active;
  box.innerHTML = '<div class="load-err">' +
    '<p>' + (isHe() ? 'לא הצלחנו לטעון את נתוני המונדיאל.' : 'Could not load World Cup data.') + '</p>' +
    '<p class="load-err-detail">' + esc(String(err && err.message || err)) + '</p>' +
    '<button class="load-retry" onclick="loadTournament(true)">' +
    (isHe() ? 'נסה שוב' : 'Retry') + '</button></div>';
}

function showSkeletons() {
  var msg = isHe() ? 'טוען משחקים...' : 'Loading matches...';
  ['group','r32','r16','qf','sf','final'].forEach(function(id) {
    var st = document.getElementById('stage-' + id);
    if (!st) return;
    var db = st.querySelector('.day-block');
    if (db && !db.innerHTML.trim()) db.innerHTML = '<div class="skeleton">' + msg + '</div>';
  });
}

// ── Match card ───────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function teamLabel(team) { return isHe() ? team.he : team.en; }

// One row per team: flag, name, that team's goals. The score can no longer end
// up mirrored against the names, because each number sits on its own team's
// line instead of in a separate LTR box beside an RTL name pair.
function teamRow(m, side) {
  var team = side === 'home' ? m.home : m.away;
  var cls = 'mc-row';
  if (m.winner === side) cls += ' w';
  if (team.placeholder) cls += ' ph';
  var flag = WC.flagFor(team);
  var html = '<div class="' + cls + '">';
  if (flag) html += '<span class="mc-fl">' + flag + '</span>';
  html += '<span class="mc-nm">' + esc(teamLabel(team)) + '</span>';
  if (m.score) {
    html += '<span class="mc-sc">' + m.score[side === 'home' ? 'h' : 'a'] + '</span>';
    if (m.pens) html += '<span class="mc-pen">(' + m.pens[side === 'home' ? 'h' : 'a'] + ')</span>';
  }
  return html + '</div>';
}

// What goes in the pulsing pill. Normally the minute; during half-time, the
// break before extra time, or a shootout there is no minute to show, so the
// phase itself takes the slot rather than a clock frozen at "45+1'".
function phaseLabel(m) {
  var p = WC.livePhase(m);
  return isHe() ? p.he : p.en;
}
function liveText(m, t) {
  return WC.liveMinute(m, (t || TOURNAMENT || {}).fetchedAt) || phaseLabel(m);
}

// The pulsing live pill, shared by the card, the banner and the bracket.
function livePill(m, t) {
  var minute = WC.liveMinute(m, (t || {}).fetchedAt);
  return '<div class="mc-live"><span class="live-dot"></span>' +
    '<span class="mc-min live-min' + (minute ? '' : ' txt') + '" data-live-id="' + esc(m.id) + '">' +
    esc(minute || phaseLabel(m)) + '</span></div>';
}

// The right-hand slot of the card header: kickoff time, live clock, or FT.
function statusSlot(m, t) {
  if (m.status === 'live') {
    var minute = WC.liveMinute(m, (t || {}).fetchedAt);
    return livePill(m, t) +
      (minute ? '<div class="mc-phase">' + esc(phaseLabel(m)) + '</div>' : '');
  }
  if (m.status === 'past') {
    var pen = m.pens ? (isHe() ? ' · פנדלים' : ' · pens') : '';
    return '<div class="mc-fin">' + (isHe() ? 'הסתיים' : 'Full time') + esc(pen) + '</div>';
  }
  return '<div class="mc-time ' + m.strip + '">' + m.time + '</div>';
}

function buildCard(m, t) {
  var label = m.group
    ? (isHe() ? 'בית ' : 'Group ') + m.group
    : m.date;

  var html = '<div class="mc ' + m.status + '">' +
    '<div class="strip ' + m.strip + '"></div>' +
    '<div class="mc-top"><span class="mc-grp">' + esc(label) + '</span>' +
    '<div class="mc-rt">' + statusSlot(m, t) + '</div></div>' +
    '<div class="mc-rows">' + teamRow(m, 'home') + teamRow(m, 'away') + '</div>';

  if (m.note) {
    html += '<div class="mc-venue"><span class="mc-note">' + esc(isHe() ? m.note.he : m.note.en) + '</span></div>';
  } else if (m.venue) {
    html += '<div class="mc-venue">📍 ' + esc(WC.venueName(m, isHe())) + '</div>';
  }
  return html + '</div>';
}

// Group matches into day blocks; knockout stages are short enough to show flat.
function renderDayBlocks(matches, t) {
  var days = [], byDay = {};
  matches.forEach(function(m) {
    if (!byDay[m.dayKey]) { byDay[m.dayKey] = []; days.push(m.dayKey); }
    byDay[m.dayKey].push(m);
  });
  return days.map(function(k) {
    var list = byDay[k], first = list[0];
    return '<div class="day-hd"><div class="day-lbl">' +
      esc(isHe() ? first.dayLabelHe : first.dayLabelEn) + '</div><div class="day-line"></div></div>' +
      '<div class="mgrid">' + list.map(function(m) { return buildCard(m, t); }).join('') + '</div>';
  }).join('');
}

function renderStage(stageKey, matches, t) {
  var st = document.getElementById('stage-' + stageKey);
  if (!st) return;
  var db = st.querySelector('.day-block');
  if (!db) return;
  if (!matches.length) { db.innerHTML = ''; return; }
  db.innerHTML = renderDayBlocks(matches, t);
  db.querySelectorAll('.mc').forEach(attachRipple);
}

// ── Stage sub-headings ───────────────────────────────────────────────
// Derived from the model on every render. The old page carried these as fixed
// strings, so "🔥 Quarter-finals start today!" was still sitting at the top of
// the tab days after the quarter-finals ended.
function renderStageHeads(t) {
  document.querySelectorAll('[data-sub]').forEach(function(el) {
    var key = el.getAttribute('data-sub');
    var s = WC.stageState(t, key);
    if (!s.total) { el.textContent = ''; return; }
    var he = isHe();
    var range = s.total > 1 ? (s.from + ' – ' + s.to) : s.from;
    var span = '<span class="wt-num">' + esc(range) + '</span>';
    var txt;
    if (s.state === 'live') {
      txt = '<span class="live-dot" style="display:inline-block;vertical-align:middle;margin-inline-end:5px"></span>' +
            (he ? 'משחק חי עכשיו · ' : 'Live now · ') + span;
    } else if (s.state === 'today') {
      txt = (he ? '🔥 מתחיל היום · ' : '🔥 Starts today · ') + span;
    } else if (s.state === 'done') {
      txt = (he ? '✅ הסתיים · ' : '✅ Completed · ') + span;
    } else if (s.state === 'next') {
      txt = (he ? '⏭ הבא בתור · ' : '⏭ Up next · ') + span;
    } else {
      txt = span;
    }
    if (s.played && s.played < s.total) {
      txt += (he ? ' · ' + s.played + '/' + s.total + ' שוחקו' : ' · ' + s.played + '/' + s.total + ' played');
    } else if (!s.played) {
      if (he) txt += s.total === 1 ? ' · משחק אחד' : ' · ' + s.total + ' משחקים';
      else    txt += s.total === 1 ? ' · 1 match'  : ' · ' + s.total + ' matches';
    }
    el.innerHTML = txt;
  });
}

function renderAll(t) {
  renderStage('group', t.stages.group, t);
  renderStage('r32',   t.stages.r32,   t);
  renderStage('r16',   t.stages.r16,   t);
  renderStage('qf',    t.stages.qf,    t);
  renderStage('sf',    t.stages.sf,    t);
  renderStage('final', t.stages.final.concat(t.stages.third).sort(function(a,b){ return a.utc - b.utc; }), t);

  renderStageHeads(t);
  if (typeof window.renderBracket === 'function') window.renderBracket(t);

  buildTeamSearch();
  renderTodayBanner(t);
  renderDataTab();
  startLiveClock(t);

  if (!stageWasChosen) {
    var cur = WC.currentStage(t);
    goStage(cur, document.querySelector('.drawer-item[data-stage="' + cur + '"]'));
    stageWasChosen = true;
  }
}

// ── Live clock ───────────────────────────────────────────────────────
// The data refresh runs every 60s while a match is live; the minute would sit
// frozen in between. Re-print it from the model every 10s so it ticks.
function startLiveClock(t) {
  clearInterval(liveClockTimer);
  if (!t.hasLive) return;
  liveClockTimer = setInterval(tickLiveClock, 10000);
}

function tickLiveClock() {
  if (!TOURNAMENT) return;
  var byId = {};
  WC.liveMatches(TOURNAMENT).forEach(function(m) { byId[m.id] = m; });
  document.querySelectorAll('.live-min').forEach(function(el) {
    var m = byId[el.getAttribute('data-live-id')];
    if (!m) return;
    var minute = WC.liveMinute(m, TOURNAMENT.fetchedAt);
    el.textContent = minute || phaseLabel(m);
    el.classList.toggle('txt', !minute);
  });
}

function manualRefresh() {
  clearTimeout(liveRefreshTimer);
  hideRefreshTip();
  loadTournament(true);
}

// ── HEAD-TO-HEAD SEARCH ──────────────────────────────────────────────
// Built from the model. The old version scraped .mc cards, so it could only
// find fixtures that happened to be rendered, and offered all 48 teams as
// opponents even for teams that never met.
var TEAM_LIST = [];        // [{abbr, he, en, flag}] sorted
var OPPONENTS = {};        // abbr -> { oppAbbr: match }

function buildTeamSearch() {
  TEAM_LIST = [];
  OPPONENTS = {};
  if (!TOURNAMENT) return;

  var seen = {};
  TOURNAMENT.all.forEach(function(m) {
    if (m.home.placeholder || m.away.placeholder) return;
    [m.home, m.away].forEach(function(t) {
      if (!seen[t.abbr]) {
        seen[t.abbr] = true;
        TEAM_LIST.push({ abbr: t.abbr, he: t.he, en: t.en, flag: t.flag });
      }
      if (!OPPONENTS[t.abbr]) OPPONENTS[t.abbr] = {};
    });
    OPPONENTS[m.home.abbr][m.away.abbr] = m;
    OPPONENTS[m.away.abbr][m.home.abbr] = m;
  });

  TEAM_LIST.sort(function(a, b) {
    return isHe() ? a.he.localeCompare(b.he, 'he') : a.en.localeCompare(b.en);
  });

  fillSelect('searchTeam1', TEAM_LIST, { he: 'בחר קבוצה 1', en: 'Team 1' });
  fillSelect('searchTeam2', [], { he: 'בחר קודם קבוצה 1', en: 'Pick team 1 first' });
}

function fillSelect(id, teams, placeholder) {
  var sel = document.getElementById(id);
  if (!sel) return;
  var keep = sel.value;
  sel.innerHTML = '<option value="">' + esc(isHe() ? placeholder.he : placeholder.en) + '</option>';
  teams.forEach(function(t) {
    var opt = document.createElement('option');
    opt.value = t.abbr;
    // <option> holds text only, so no markup fallback. Where the platform has no
    // flag font we simply show the name — never a Latin code beside a Hebrew name.
    var mark = WC.flagsSupported() ? t.flag : '';
    opt.textContent = (mark ? mark + ' ' : '') + (isHe() ? t.he : t.en);
    sel.appendChild(opt);
  });
  if (keep && sel.querySelector('option[value="' + keep + '"]')) sel.value = keep;
  sel.disabled = teams.length === 0;
}

// Team A chosen -> team B may only be a side A actually played.
function onTeam1Change() {
  var a = document.getElementById('searchTeam1').value;
  var sel2 = document.getElementById('searchTeam2');
  if (!a) {
    fillSelect('searchTeam2', [], { he: 'בחר קודם קבוצה 1', en: 'Pick team 1 first' });
    hideSearchResult();
    return;
  }
  var oppAbbrs = Object.keys(OPPONENTS[a] || {});
  var opps = TEAM_LIST.filter(function(t) { return oppAbbrs.indexOf(t.abbr) !== -1; });
  var prev = sel2.value;
  fillSelect('searchTeam2', opps, { he: 'בחר יריבה', en: 'Pick opponent' });
  if (prev && oppAbbrs.indexOf(prev) !== -1) { sel2.value = prev; runTeamSearch(); }
  else hideSearchResult();
}

function resetTeamSearch() {
  var s1 = document.getElementById('searchTeam1');
  if (s1) s1.value = '';
  fillSelect('searchTeam2', [], { he: 'בחר קודם קבוצה 1', en: 'Pick team 1 first' });
  hideSearchResult();
}

function hideSearchResult() {
  var res = document.getElementById('searchResult');
  if (res) res.classList.remove('show');
}

function runTeamSearch() {
  var a = document.getElementById('searchTeam1').value;
  var b = document.getElementById('searchTeam2').value;
  var res = document.getElementById('searchResult');
  if (!res) return;
  if (!a || !b || a === b) { hideSearchResult(); return; }

  var m = (OPPONENTS[a] || {})[b];
  var srTeams = document.getElementById('srTeams');
  var srScore = document.getElementById('srScore');
  var srMeta  = document.getElementById('srMeta');
  var he = isHe();

  if (!m) {
    srTeams.innerHTML = '';
    srScore.textContent = '';
    srMeta.textContent = he ? 'הקבוצות לא שיחקו אחת נגד השנייה' : 'These teams did not face each other';
    srMeta.className = 'sr-meta sr-none';
    res.classList.add('show');
    return;
  }

  var stage = he ? WC.STAGE_HE[m.stage] : WC.STAGE_EN[m.stage];

  // Same two-row scoreline as the cards — the score cannot read backwards.
  srTeams.innerHTML = '<div class="mc-rows">' + teamRow(m, 'home') + teamRow(m, 'away') + '</div>';

  if (m.status === 'future') {
    srScore.textContent = m.time;
    srMeta.textContent = (he ? 'טרם התרחש · ' : 'Not played yet · ') + stage + ' · ' + m.date;
    srMeta.className = 'sr-meta sr-none';
  } else {
    srScore.textContent = '';
    var extra = '';
    if (m.status === 'live') {
      extra = ' · ' + (he ? 'משחק חי' : 'Live now');
    } else if (m.winner) {
      // Only a knockout winner advances; a group win is just a win.
      var w = teamLabel(m.winner === 'home' ? m.home : m.away);
      if (m.stage === 'group') extra = ' · ' + (he ? w + ' ניצחה' : w + ' won');
      else                     extra = ' · ' + (he ? w + ' עלתה' : w + ' advanced');
    }
    srMeta.textContent = stage + ' · ' + m.date + extra;
    srMeta.className = m.status === 'live' ? 'sr-meta sr-live' : 'sr-meta';
  }
  res.classList.add('show');
}

// A shootout ended 0-0 in normal time. Printing "0 – 0" alone reads as a draw,
// so the shootout score travels with the scoreline everywhere it is shown.
function scoreLine(m) {
  if (!m.score) return '';
  var s = m.score.h + ' – ' + m.score.a;
  if (m.pens) s += ' (' + m.pens.h + '–' + m.pens.a + ')';
  return s;
}

// ── TODAY'S MATCH BANNER ─────────────────────────────────────────────
var bannerTimer = null;

function renderTodayBanner(t) {
  var box = document.getElementById('todayBanner');
  if (!box) return;
  var todayKey = WC.ilParts(new Date()).dayKey;
  var todays = t.all.filter(function(m) { return m.dayKey === todayKey; });

  if (!todays.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
  box.style.display = '';

  var he = isHe();
  box.innerHTML = todays.map(function(m) {
    var stage = he ? WC.STAGE_HE[m.stage] : WC.STAGE_EN[m.stage];
    var right, cls, tag;
    if (m.status === 'live') {
      var minute = WC.liveMinute(m, t.fetchedAt);
      cls = 'tb live';
      tag = he ? 'משחק חי' : 'Live now';
      right = livePill(m, t) +
              (minute ? '<div class="tb-sub">' + esc(phaseLabel(m)) + '</div>' : '');
    } else if (m.status === 'past') {
      cls = 'tb done';
      tag = he ? 'היום' : 'Today';
      right = '<div class="tb-sub">' + (he ? 'הסתיים' : 'Full time') + '</div>';
    } else {
      cls = 'tb up';
      tag = he ? 'המשחק של היום' : "Today's match";
      right = '<div class="tb-time">' + m.time + '</div>' +
              '<div class="tb-sub tb-count" data-utc="' + m.utc.getTime() + '"></div>';
    }
    return '<div class="' + cls + '">' +
      '<div class="tb-tag">' + esc(tag) + '</div>' +
      '<div class="mc-rows tb-rows">' + teamRow(m, 'home') + teamRow(m, 'away') + '</div>' +
      '<div class="tb-right">' + right + '</div>' +
      '<div class="tb-stage">' + esc(stage) + ' · ' + esc(WC.venueName(m, he)) + '</div>' +
    '</div>';
  }).join('');

  tickCountdown();
  clearInterval(bannerTimer);
  bannerTimer = setInterval(tickCountdown, 30000);
}

function tickCountdown() {
  var he = isHe();
  document.querySelectorAll('.tb-count').forEach(function(el) {
    var ms = parseInt(el.getAttribute('data-utc'), 10) - Date.now();
    if (ms <= 0) { el.textContent = he ? 'מתחיל עכשיו' : 'Starting now'; return; }
    var h = Math.floor(ms / 3600000);
    var mnt = Math.floor((ms % 3600000) / 60000);
    el.textContent = he
      ? 'בעוד ' + (h ? h + ' שע\' ' : '') + mnt + ' דק\''
      : 'in ' + (h ? h + 'h ' : '') + mnt + 'm';
  });
}

// ── DATA TAB ─────────────────────────────────────────────────────────
// Four hero numbers, then panels, then everything else folded away. Modelled on
// how SofaScore / FotMob / Opta present a tournament: a small number of large
// figures up front, top-3 leaderboards rather than full tables, and the long
// lists behind a toggle. The old tab gave a 6-tile grid, a full hour table and
// all 100+ remaining fixtures equal weight, so nothing read as a headline.
function renderDataTab() {
  var box = document.getElementById('watchTable');
  if (!box || !TOURNAMENT) return;
  var t = TOURNAMENT;
  var he = isHe();
  var s = WC.tournamentStats(t);

  var alive = {};
  t.all.forEach(function(m) {
    if (m.status === 'past') return;
    if (!m.home.placeholder) alive[m.home.abbr] = m.home;
    if (!m.away.placeholder) alive[m.away.abbr] = m.away;
  });
  var aliveList = Object.keys(alive).map(function(k) { return alive[k]; });
  var left = WC.upcoming(t);

  function tile(v, labelHe, labelEn) {
    return '<div class="ds hero"><div class="ds-v">' + v + '</div>' +
      '<div class="ds-l">' + esc(he ? labelHe : labelEn) + '</div></div>';
  }
  function head(hHe, hEn) {
    return '<div class="wt-h">' + esc(he ? hHe : hEn) + '</div>';
  }
  function fact(labelHe, labelEn, v) {
    return '<div class="fx-i"><span class="fx-l">' + esc(he ? labelHe : labelEn) + '</span>' +
      '<span class="fx-v">' + v + '</span></div>';
  }

  var html = '<div class="wt-wrap">';

  // ── hero strip
  html += '<div class="ds-grid">' +
    tile(s.goals, 'שערים', 'Goals') +
    tile(s.avg.toFixed(2), 'ממוצע למשחק', 'Goals / match') +
    tile(left.length, 'משחקים שנותרו', 'Matches left') +
    tile(aliveList.length, 'קבוצות שנותרו', 'Teams left') +
    '</div>';

  // ── one narrative line, not a table
  var pctOne = s.played ? Math.round(s.oneGoalGames / s.played * 100) : 0;
  html += '<div class="ds-lede">' + (he
    ? 'אחרי <b>' + s.played + '</b> מתוך <b>' + s.total + '</b> משחקים נרשמו <b>' + s.goals +
      '</b> שערים — <b>' + s.avg.toFixed(2) + '</b> למשחק. <b>' + pctOne + '%</b> מהמשחקים הוכרעו בשער אחד.'
    : 'After <b>' + s.played + '</b> of <b>' + s.total + '</b> matches: <b>' + s.goals +
      '</b> goals at <b>' + s.avg.toFixed(2) + '</b> per game. <b>' + pctOne + '%</b> were decided by a single goal.') +
    '</div>';

  // ── top scorers (top 5, bars relative to the leader)
  if (s.scorers.length) {
    var top = s.scorers.slice(0, 5);
    var best = top[0].goals || 1;
    html += head('מלך השערים', 'Top scorers') + '<div class="lb">' +
      top.map(function(p, i) {
        var flag = WC.flagFor(p.team);
        return '<div class="lb-row' + (i === 0 ? ' top' : '') + '">' +
          '<span class="lb-rk">' + (i + 1) + '</span>' +
          (flag ? '<span class="mc-fl">' + flag + '</span>' : '') +
          '<span class="lb-nm">' + esc(WC.playerName(p.name, he)) + '</span>' +
          '<span class="lb-sub">' + esc(teamLabel(p.team)) + '</span>' +
          '<span class="lb-bar"><i style="width:' + Math.round(p.goals / best * 100) + '%"></i></span>' +
          '<span class="lb-v">' + p.goals + '</span></div>';
      }).join('') + '</div>';
  }

  // ── goals by stage: the one trend a score-only dataset can honestly show
  if (s.byStage.length > 1) {
    var peak = Math.max.apply(null, s.byStage.map(function(g) { return g.avg; })) || 1;
    html += head('ממוצע שערים לפי שלב', 'Goals per match, by stage') +
      '<div class="gstrip">' + s.byStage.map(function(g) {
        var label = he ? WC.STAGE_HE[g.stage] : WC.STAGE_EN[g.stage];
        return '<div class="gcol">' +
          '<span class="gv">' + g.avg.toFixed(1) + '</span>' +
          '<span class="gb" style="height:' + Math.round(10 + g.avg / peak * 54) + 'px"></span>' +
          '<span class="gl" title="' + esc(label) + '">' + esc(label) + '</span></div>';
      }).join('') + '</div>';
  }

  // ── records + discipline
  html += head('מספרים', 'The numbers') + '<div class="fx">' +
    fact('שערים שלא ספגו (משחקי שער נקי)', 'Clean sheets', s.cleanSheets) +
    fact('הוכרעו בשער אחד', 'Decided by one goal', s.oneGoalGames) +
    fact('תיקו', 'Draws', s.draws) +
    fact('0-0', 'Goalless draws', s.goalless) +
    fact('הכרעות בפנדלים', 'Shootouts', s.shootouts) +
    fact('הוארכו', 'Went to extra time', s.extraTime) +
    fact('שערים מפנדל', 'Penalty goals', s.penaltyGoals) +
    fact('שערים עצמיים', 'Own goals', s.ownGoals) +
    fact('שערים מדקה 80', 'Goals from the 80th min', s.lateGoals) +
    fact('כרטיסים צהובים', 'Yellow cards', s.yellow) +
    fact('כרטיסים אדומים', 'Red cards', s.red) +
    fact('נצחונות קבוצת הבית', 'Home-side wins', s.homeWins) +
    '</div>';

  // ── attack / defence leaders, top 3 each
  var played3 = s.teams.filter(function(x) { return x.p >= 3; });
  if (played3.length >= 3) {
    var atk = played3.slice().sort(function(a, b) { return b.gf - a.gf || a.ga - b.ga; }).slice(0, 3);
    var def = played3.slice().sort(function(a, b) { return a.ga - b.ga || b.cs - a.cs; }).slice(0, 3);
    var maxGf = atk[0].gf || 1;
    var maxGa = Math.max.apply(null, def.map(function(x) { return x.ga; })) || 1;

    function lbRow(x, i, val, ratio, subHe, subEn) {
      var flag = WC.flagFor(x);
      return '<div class="lb-row' + (i === 0 ? ' top' : '') + '">' +
        '<span class="lb-rk">' + (i + 1) + '</span>' +
        (flag ? '<span class="mc-fl">' + flag + '</span>' : '') +
        '<span class="lb-nm">' + esc(he ? x.he : x.en) + '</span>' +
        '<span class="lb-sub">' + esc(he ? subHe : subEn) + '</span>' +
        '<span class="lb-bar"><i style="width:' + Math.round(ratio * 100) + '%"></i></span>' +
        '<span class="lb-v">' + val + '</span></div>';
    }

    html += head('ההתקפה הטובה ביותר', 'Best attack') + '<div class="lb">' +
      atk.map(function(x, i) {
        return lbRow(x, i, x.gf, x.gf / maxGf, x.p + ' מש׳', x.p + ' pl');
      }).join('') + '</div>';

    html += head('ההגנה הטובה ביותר', 'Best defence') + '<div class="lb">' +
      def.map(function(x, i) {
        return lbRow(x, i, x.ga, 1 - (x.ga / (maxGa + 1)),
          x.cs + ' שער נקי', x.cs + ' CS');
      }).join('') + '</div>';
  }

  // ── single-match records
  if (s.biggest) {
    html += head('משחקי השיא', 'Match records') +
      '<div class="fx">' +
      '<div class="fx-i"><span class="fx-l">' + (he ? 'הניצחון הגדול' : 'Biggest win') + '<br>' +
        '<span class="ds-big" style="display:block;border:none;background:none;padding:4px 0 0;text-align:start;font-size:12px">' +
        esc(teamLabel(s.biggest.m.home)) + ' ' + scoreLine(s.biggest.m) + ' ' + esc(teamLabel(s.biggest.m.away)) +
        '</span></span><span class="fx-v">+' + s.biggest.diff + '</span></div>' +
      '<div class="fx-i"><span class="fx-l">' + (he ? 'המשחק עתיר השערים' : 'Highest scoring') + '<br>' +
        '<span class="ds-big" style="display:block;border:none;background:none;padding:4px 0 0;text-align:start;font-size:12px">' +
        esc(teamLabel(s.highest.m.home)) + ' ' + scoreLine(s.highest.m) + ' ' + esc(teamLabel(s.highest.m.away)) +
        '</span></span><span class="fx-v">' + s.highest.total + '</span></div>' +
      '</div>';
  }

  // ── who is left
  if (aliveList.length && aliveList.length <= 12) {
    html += head('עדיין בפנים', 'Still in it') +
      '<div class="ds-teams">' + aliveList.map(function(tm) {
        var flag = WC.flagFor(tm);
        return '<span class="ds-chip">' + (flag ? flag + ' ' : '') + esc(teamLabel(tm)) + '</span>';
      }).join('') + '</div>';
  }

  // ── everything long lives behind the toggle
  html += '<button class="ds-more" onclick="toggleMoreData(this)">' +
    (he ? 'עוד נתונים ▾' : 'More numbers ▾') + '</button><div class="ds-fold" id="dsFold">';

  var counts = { safe: 0, warn: 0, danger: 0 };
  t.all.forEach(function(m) { counts[m.strip]++; });
  var leftCounts = { safe: 0, warn: 0, danger: 0 };
  left.forEach(function(m) { leftCounts[m.strip]++; });

  var ROWS = [
    { k: 'safe',   he: 'שעה נוחה', en: 'Good hour',  hours: '06:00–23:59' },
    { k: 'warn',   he: 'מאוחר',     en: 'Late',       hours: '00:00–01:59' },
    { k: 'danger', he: 'לילה עמוק', en: 'Deep night', hours: '02:00–05:59' }
  ];
  html += head('נוחות שעות · כל הטורניר', 'Hour comfort · whole tournament') +
    '<table class="wt"><thead><tr>' +
    '<th>' + (he ? 'קטגוריה' : 'Category') + '</th>' +
    '<th>' + (he ? 'שעות' : 'Hours') + '</th>' +
    '<th>' + (he ? 'סה״כ' : 'Total') + '</th>' +
    '<th>' + (he ? 'נשארו' : 'Left') + '</th></tr></thead><tbody>';
  ROWS.forEach(function(r) {
    html += '<tr><td><span class="wt-dot ' + r.k + '"></span>' + esc(he ? r.he : r.en) + '</td>' +
      '<td class="wt-num">' + r.hours + '</td>' +
      '<td class="wt-num">' + counts[r.k] + '</td>' +
      '<td class="wt-num wt-left">' + (leftCounts[r.k] || '—') + '</td></tr>';
  });
  html += '</tbody></table>';

  if (left.length) {
    html += head('נשארו לצפייה', 'Left to watch') +
      '<table class="wt"><tbody>' + left.map(function(m) {
        return '<tr><td class="wt-num">' + esc(m.date) + '</td><td class="wt-num">' + esc(m.time) + '</td>' +
          '<td><span class="wt-dot ' + m.strip + '"></span>' +
          esc(teamLabel(m.home) + ' – ' + teamLabel(m.away)) + '</td>' +
          '<td class="wt-num">' + esc(he ? WC.STAGE_HE[m.stage] : WC.STAGE_EN[m.stage]) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  box.innerHTML = html + '</div></div>';
}

function toggleMoreData(btn) {
  var fold = document.getElementById('dsFold');
  if (!fold) return;
  var open = fold.classList.toggle('open');
  btn.textContent = isHe()
    ? (open ? 'פחות נתונים ▴' : 'עוד נתונים ▾')
    : (open ? 'Fewer numbers ▴' : 'More numbers ▾');
}

// ── LANGUAGE WRAPPER (rebuild dynamic content on switch) ──
var _origSetLang = setLang;
setLang = function(lang) {
  _origSetLang(lang);
  if (TOURNAMENT) renderAll(TOURNAMENT);
  resetTeamSearch();
  chatUpdateDir();
};

// ── AI CHAT ──────────────────────────────────────────────────────────
var CHAT_PROXY_URL = 'https://worldcup-ai.yoavstern1357.workers.dev';
var CHAT_TIMEOUT_MS = 30000;
var CHAT_RETRIES = 2;          // 3 attempts total, then a retry button
var chatHistory = [];
var chatOpen = false;
var chatBusy = false;

function buildSystemPrompt() {
  var t = TOURNAMENT;
  if (!t) {
    return 'You are a helpful assistant for a FIFA World Cup 2026 schedule page. ' +
           'Match data has not loaded yet; say so rather than guessing.';
  }

  var nowIl = WC.ilParts(new Date());
  function line(m) {
    var s = m.home.en + ' vs ' + m.away.en;
    if (m.status === 'past') {
      s = m.home.en + ' ' + m.score.h + '-' + m.score.a + ' ' + m.away.en;
      if (m.pens) s += ' (pens ' + m.pens.h + '-' + m.pens.a + ')';
      var w = m.winner === 'home' ? m.home.en : (m.winner === 'away' ? m.away.en : null);
      if (w) s += ' [' + w + ' advanced]';
    } else if (m.status === 'live') {
      s += ' [LIVE ' + (m.score ? m.score.h + '-' + m.score.a : '0-0') +
           ', ' + WC.liveMinute(m, t.fetchedAt) + ' ' + WC.livePhase(m).en + ']';
    } else {
      s += ' at ' + m.time + ' IL on ' + m.date;
    }
    return '  ' + WC.STAGE_EN[m.stage] + ': ' + s;
  }

  var live = WC.liveMatches(t);
  var up = WC.upcoming(t).filter(function(m){ return m.status === 'future'; });
  var ko = t.all.filter(function(m){ return m.stage !== 'group' && m.status === 'past'; });
  var todays = t.all.filter(function(m){ return m.dayKey === nowIl.dayKey; });

  var eliminated = [];
  t.all.forEach(function(m) {
    if (m.stage === 'group' || m.status !== 'past' || !m.winner) return;
    var loser = m.winner === 'home' ? m.away : m.home;
    if (!loser.placeholder) eliminated.push(loser.en);
  });

  var st = WC.tournamentStats(t);
  var scorers = st.scorers.slice(0, 10).map(function(p) {
    return p.name + ' (' + p.team.en + ') ' + p.goals;
  }).join('; ');

  return 'You are a helpful assistant for a FIFA World Cup 2026 live schedule page.\n' +
    'Answer concisely. Reply in the language the user writes (Hebrew or English).\n' +
    'Right now it is ' + nowIl.time + ' Israel time on ' + nowIl.dayLabelEn + ' (' + nowIl.dayKey + ').\n' +
    'All times below are Israel time (UTC+3).\n\n' +
    'TODAY\'S MATCHES:\n' + (todays.length ? todays.map(line).join('\n') : '  None') + '\n\n' +
    (live.length ? 'LIVE NOW:\n' + live.map(line).join('\n') + '\n\n' : '') +
    'UPCOMING (' + up.length + '):\n' + (up.length ? up.map(line).join('\n') : '  None — tournament over') + '\n\n' +
    'KNOCKOUT RESULTS SO FAR:\n' + (ko.length ? ko.map(line).join('\n') : '  None yet') + '\n\n' +
    'ELIMINATED IN KNOCKOUTS: ' + (eliminated.length ? eliminated.join(', ') : 'none') + '\n\n' +
    'TOURNAMENT TOTALS: ' + st.played + ' of ' + st.total + ' matches played, ' + st.goals + ' goals (' +
      st.avg.toFixed(2) + '/match), ' + st.shootouts + ' shootouts, ' + st.yellow + ' yellow cards, ' +
      st.red + ' red cards.\n' +
    'TOP SCORERS: ' + (scorers || 'none yet') + '\n\n' +
    'Tournament: Jun 11 - Jul 19 2026 · USA / Canada / Mexico · 48 teams · 104 matches.\n' +
    'Answer only from the data above. If it is not there, say you do not have it.';
}

function toggleChat() {
  chatOpen ? closeChat() : openChat();
}

function openChat() {
  chatOpen = true;
  var panel = document.getElementById('chatPanel');
  if (panel) panel.classList.add('open');
  var btn = document.getElementById('chatFloatBtn');
  if (btn) btn.classList.add('active');
  // guard on the messages container: the welcome bubble isn't tracked in
  // chatHistory, so a second open would otherwise stack a duplicate greeting
  var msgs = document.getElementById('chatMessages');
  if (chatHistory.length === 0 && msgs && !msgs.children.length) {
    var heMsg = 'שלום! אני יכול לענות על שאלות לגבי המונדיאל 2026 — תוצאות, לוח משחקים, קבוצות ועוד. שאל אותי!';
    var enMsg = 'Hi! Ask me anything about the 2026 World Cup — results, schedule, groups, and more.';
    var welcome = addChatBubble('assistant', isHe() ? heMsg : enMsg);
    // tag it so setLang retranslates the boilerplate greeting (real messages stay put)
    if (welcome) { welcome.setAttribute('data-he', heMsg); welcome.setAttribute('data-en', enMsg); }
  }
  setTimeout(function(){
    var inp = document.getElementById('chatInputField');
    if (inp) inp.focus();
  }, 300);
}

function closeChat() {
  chatOpen = false;
  var panel = document.getElementById('chatPanel');
  if (panel) panel.classList.remove('open');
  var btn = document.getElementById('chatFloatBtn');
  if (btn) btn.classList.remove('active');
}

function chatUpdateDir() {
  var panel = document.getElementById('chatPanel');
  if (panel) panel.setAttribute('dir', isHe() ? 'rtl' : 'ltr');
}

function addChatBubble(role, text) {
  var msgs = document.getElementById('chatMessages');
  if (!msgs) return null;
  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-' + role;
  bubble.textContent = text;
  msgs.appendChild(bubble);
  msgs.scrollTop = msgs.scrollHeight;
  return bubble;
}

function setChatTyping(show) {
  var existing = document.getElementById('chatTyping');
  if (show) {
    if (existing) return;
    var typing = document.createElement('div');
    typing.id = 'chatTyping';
    typing.className = 'chat-bubble chat-assistant chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    var msgs = document.getElementById('chatMessages');
    if (msgs) { msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight; }
  } else {
    if (existing) existing.remove();
  }
}

function setChatBusy(busy) {
  chatBusy = busy;
  var send = document.getElementById('chatSendBtn');
  var inp = document.getElementById('chatInputField');
  if (send) send.disabled = busy;
  if (inp) inp.disabled = busy;
  setChatTyping(busy);
}

// One request, with a hard timeout. A fetch that never settles is the reason a
// hung chat used to look like a silent failure: no error, no answer, forever.
function chatRequest(contents) {
  var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function() { if (ctrl) ctrl.abort(); }, CHAT_TIMEOUT_MS);

  return fetch(CHAT_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildSystemPrompt() }] },
      contents: contents,
      // thinkingBudget is also set worker-side. It is repeated here so the page
      // is fixed the moment it ships, without waiting on a worker deploy: the
      // old worker forwards generationConfig untouched. Measured against the
      // live worker, a long question spent 977 tokens thinking, hit MAX_TOKENS,
      // and came back with a 43-character stub of an answer.
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: 0 }
      }
    }),
    signal: ctrl ? ctrl.signal : undefined
  }).then(function(r) {
    clearTimeout(timer);
    return r.json().then(function(data) {
      if (!r.ok && !(data && data.reply)) {
        var e = new Error((data && data.error && data.error.message) || ('HTTP ' + r.status));
        e.retryable = r.status >= 500 || r.status === 429;
        throw e;
      }
      return data;
    });
  }, function(err) {
    clearTimeout(timer);
    var e = new Error(err && err.name === 'AbortError' ? 'timeout' : 'network');
    e.retryable = true;
    throw e;
  });
}

// The worker answers { reply } on success and { error } on failure, so the page
// no longer has to dig through Gemini's candidate/parts shape (and no longer
// prints "⚠️ Error" when a candidate came back with no text at all).
function replyOf(data) {
  if (data && typeof data.reply === 'string' && data.reply.trim()) return data.reply.trim();
  // tolerate a raw Gemini payload, in case an older worker is still deployed
  var c = data && data.candidates && data.candidates[0];
  var parts = c && c.content && c.content.parts;
  if (parts && parts.length) {
    var txt = parts.map(function(p) { return p.text || ''; }).join('').trim();
    if (txt) return txt;
  }
  return '';
}

function sendChatWithRetry(contents, attempt) {
  return chatRequest(contents).then(function(data) {
    var reply = replyOf(data);
    if (reply) return reply;
    var msg = (data && data.error && data.error.message) || 'empty';
    var e = new Error(msg);
    e.retryable = true;
    throw e;
  }).catch(function(err) {
    if (attempt < CHAT_RETRIES && err && err.retryable) {
      // linear back-off; the worker also rotates keys internally on its side
      return new Promise(function(res) { setTimeout(res, 700 * (attempt + 1)); })
        .then(function() { return sendChatWithRetry(contents, attempt + 1); });
    }
    throw err;
  });
}

function sendChat() {
  var inp = document.getElementById('chatInputField');
  if (!inp || chatBusy) return;
  var text = inp.value.trim();
  if (!text) return;

  inp.value = '';
  addChatBubble('user', text);
  chatHistory.push({ role: 'user', parts: [{ text: text }] });
  setChatBusy(true);

  var contents = chatHistory.slice(-10).map(function(m) {
    return { role: m.role, parts: m.parts || [{ text: m.content || '' }] };
  });

  sendChatWithRetry(contents, 0).then(function(reply) {
    setChatBusy(false);
    chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    addChatBubble('assistant', reply);
  }).catch(function(err) {
    setChatBusy(false);
    // The failed turn must not stay in the history: replaying a user message the
    // model never answered is what made the next question fail too.
    chatHistory.pop();
    chatFailure(text, String((err && err.message) || 'error'));
  });
}

// A dead end with no way forward is what made the chat feel broken. Every
// failure now says what happened and offers to send the same question again.
function chatFailure(text, reason) {
  var he = isHe();
  var msg;
  if (reason === 'timeout') msg = he ? 'התשובה לקחה יותר מדי זמן.' : 'The answer took too long.';
  else if (reason === 'network') msg = he ? 'אין חיבור לשרת.' : 'Could not reach the server.';
  else msg = he ? 'השירות עמוס כרגע.' : 'The service is busy right now.';

  var bubble = addChatBubble('assistant', msg + ' ');
  if (!bubble) return;
  var again = document.createElement('button');
  again.className = 'chat-retry';
  again.textContent = he ? 'נסה שוב' : 'Try again';
  again.onclick = function() {
    bubble.remove();
    var inp = document.getElementById('chatInputField');
    if (inp) { inp.value = text; sendChat(); }
  };
  bubble.appendChild(again);
}

document.addEventListener('DOMContentLoaded', function() {
  var inp = document.getElementById('chatInputField');
  if (inp) {
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
  }
});

// ── INIT ──
// stageWasChosen: the first render jumps to whatever stage is in play today.
// Once the user picks a tab themselves, refreshes must not yank them back.
var stageWasChosen = false;

showSkeletons();
loadTournament(false);
