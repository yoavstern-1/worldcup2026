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
var matchIndex = {};
var liveRefreshTimer = null;
var hasLiveGames = false;
var lastFetchTime = 0;





var SYNC_ICON = { live: '🔴', stale: '⚠️', error: '⚠️', ok: '↺' };

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
  setSyncBar('loading', curLang === 'he' ? 'מעדכן נתונים...' : 'Fetching live data...');
  WC.load(function(err, t) {
    if (err) { renderHardError(err); return; }
    TOURNAMENT = t;
    hasLiveGames = t.hasLive;
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
    setSyncBar('stale', curLang === 'he'
      ? 'נתונים ישנים · לא הצלחנו להתעדכן'
      : 'Stale data · could not refresh');
    return;
  }
  var timeStr = t.updatedAt.toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
  if (t.hasLive) {
    setSyncBar('live', (curLang === 'he' ? '🔴 משחק חי · עדכון: ' : '🔴 Live now · Updated: ') + timeStr);
  } else {
    setSyncBar('ok', (curLang === 'he' ? 'עודכן: ' : 'Updated: ') + timeStr);
  }
}

function renderHardError(err) {
  setSyncBar('error', curLang === 'he' ? 'שגיאה בטעינת נתונים' : 'Failed to load data');
  var active = document.querySelector('.stage.active') || document.getElementById('stage-qf');
  if (!active) return;
  var box = active.querySelector('.day-block') || active;
  box.innerHTML = '<div class="load-err">' +
    '<p data-he="לא הצלחנו לטעון את נתוני המונדיאל." data-en="Could not load World Cup data.">' +
    (curLang === 'he' ? 'לא הצלחנו לטעון את נתוני המונדיאל.' : 'Could not load World Cup data.') + '</p>' +
    '<p class="load-err-detail">' + String(err && err.message || err) + '</p>' +
    '<button class="load-retry" onclick="loadTournament(true)" data-he="נסה שוב" data-en="Retry">' +
    (curLang === 'he' ? 'נסה שוב' : 'Retry') + '</button></div>';
}

function showSkeletons() {
  var msg = curLang === 'he' ? 'טוען משחקים...' : 'Loading matches...';
  ['group','r32','r16','qf','sf','final'].forEach(function(id) {
    var st = document.getElementById('stage-' + id);
    if (!st) return;
    var db = st.querySelector('.day-block');
    if (db && !db.innerHTML.trim()) db.innerHTML = '<div class="skeleton">' + msg + '</div>';
  });
}

// ── Match card (same markup the static cards used, so the CSS and the team
//    search selector '.mc-team span[data-en]' keep working) ──
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function teamSpan(team, extraClass) {
  var flag = WC.flagFor(team);
  return '<span class="mc-team' + (extraClass ? ' ' + extraClass : '') + '">' +
    (flag ? flag + ' ' : '') +
    '<span data-he="' + esc(team.he) + '" data-en="' + esc(team.en) + '">' +
    esc(curLang === 'en' ? team.en : team.he) + '</span></span>';
}

function buildCard(m) {
  var cls = 'mc ' + m.status;
  var rt;
  if (m.status === 'past') {
    var pen = m.pens ? (curLang === 'he' ? ' פנד׳' : ' PEN') : '';
    rt = '<div class="score">' + scoreLine(m) + '</div>' +
         '<div class="mc-fin" data-he="סיום' + pen + '" data-en="FT' + pen + '">' +
         (curLang === 'he' ? 'סיום' : 'FT') + pen + '</div>';
  } else if (m.status === 'live') {
    rt = '<div class="score">' + scoreLine(m) + '</div>';
  } else {
    rt = '<div class="mc-time ' + m.strip + '">' + m.time + '</div>';
  }
  var label = m.group
    ? '<span data-he="בית" data-en="Group">' + (curLang === 'he' ? 'בית' : 'Group') + '</span> ' + m.group
    : esc(m.date);

  var html = '<div class="' + cls + '">' +
    (m.status === 'live' ? '<div class="live-tag">🔴 LIVE</div>' : '') +
    '<div class="strip ' + m.strip + '"></div>' +
    '<div class="mc-top"><span class="mc-grp">' + label + '</span><div class="mc-rt">' + rt + '</div></div>' +
    '<div class="mc-teams">' + teamSpan(m.home) +
      '<span class="mc-vs" data-he="נגד" data-en="vs">' + (curLang === 'he' ? 'נגד' : 'vs') + '</span>' +
      teamSpan(m.away, 'b') + '</div>';
  if (m.note) {
    html += '<div class="mc-venue"><span class="mc-note" data-he="' + esc(m.note.he) + '" data-en="' + esc(m.note.en) + '">' +
      esc(curLang === 'he' ? m.note.he : m.note.en) + '</span></div>';
  } else if (m.venue) {
    html += '<div class="mc-venue">📍 <span data-he="' + esc(m.venue) + '" data-en="' + esc(m.venue) + '">' + esc(m.venue) + '</span></div>';
  }
  return html + '</div>';
}

// Group matches into day blocks; knockout stages are short enough to show flat.
function renderDayBlocks(matches) {
  var days = [], byDay = {};
  matches.forEach(function(m) {
    if (!byDay[m.dayKey]) { byDay[m.dayKey] = []; days.push(m.dayKey); }
    byDay[m.dayKey].push(m);
  });
  return days.map(function(k) {
    var list = byDay[k], first = list[0];
    return '<div class="day-hd"><div class="day-lbl" data-he="' + esc(first.dayLabelHe) + '" data-en="' + esc(first.dayLabelEn) + '">' +
      esc(curLang === 'he' ? first.dayLabelHe : first.dayLabelEn) + '</div><div class="day-line"></div></div>' +
      '<div class="mgrid">' + list.map(buildCard).join('') + '</div>';
  }).join('');
}

function renderStage(stageKey, matches, grouped) {
  var st = document.getElementById('stage-' + stageKey);
  if (!st) return;
  var db = st.querySelector('.day-block');
  if (!db) return;
  if (!matches.length) { db.innerHTML = ''; return; }
  db.innerHTML = grouped ? renderDayBlocks(matches) : '<div class="mgrid">' + matches.map(buildCard).join('') + '</div>';
  db.querySelectorAll('.mc').forEach(attachRipple);
}

// The bracket owns #bracketBox and nothing else touches it. It is moved to
// whichever knockout stage is current, so it sits above that stage\'s cards.
function placeBracket(stageKey) {
  if (['r16','qf','sf','final'].indexOf(stageKey) === -1) return;
  var st = document.getElementById('stage-' + stageKey);
  if (!st) return;
  var box = document.getElementById('bracketBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'bracketBox';
  }
  var anchor = st.querySelector('.stage-info') || st.querySelector('.sec-head');
  if (anchor && anchor.nextSibling) st.insertBefore(box, anchor.nextSibling);
  else st.appendChild(box);
}

function renderAll(t) {
  renderStage('group', t.stages.group, true);
  renderStage('r32',   t.stages.r32,   true);
  renderStage('r16',   t.stages.r16,   true);
  renderStage('qf',    t.stages.qf,    true);
  renderStage('sf',    t.stages.sf,    true);
  renderStage('final', t.stages.final.concat(t.stages.third), true);

  var cur = WC.currentStage(t);
  placeBracket(cur);
  if (typeof window.renderBracket === 'function') window.renderBracket(t);

  buildTeamSearch();
  renderTodayBanner(t);
  renderDataTab();

  if (!stageWasChosen) { goStage(cur, document.querySelector('.drawer-item[data-stage="' + cur + '"]')); stageWasChosen = true; }
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
    return (curLang === 'he' ? a.he.localeCompare(b.he, 'he') : a.en.localeCompare(b.en));
  });

  fillSelect('searchTeam1', TEAM_LIST, { he: 'בחר קבוצה 1', en: 'Team 1' });
  fillSelect('searchTeam2', [], { he: 'בחר קודם קבוצה 1', en: 'Pick team 1 first' });
}

function fillSelect(id, teams, placeholder) {
  var sel = document.getElementById(id);
  if (!sel) return;
  var keep = sel.value;
  sel.innerHTML = '<option value="" data-he="' + placeholder.he + '" data-en="' + placeholder.en + '">' +
    (curLang === 'he' ? placeholder.he : placeholder.en) + '</option>';
  teams.forEach(function(t) {
    var opt = document.createElement('option');
    opt.value = t.abbr;
    opt.setAttribute('data-he', t.he);
    opt.setAttribute('data-en', t.en);
    // <option> can hold text only, so no markup fallback here — use the raw code
    var mark = WC.flagsSupported() ? t.flag : t.abbr;
    opt.textContent = (mark ? mark + ' ' : '') + (curLang === 'he' ? t.he : t.en);
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
  var he = curLang === 'he';

  if (!m) {
    srTeams.textContent = '';
    srScore.textContent = '';
    srMeta.textContent = he ? 'הקבוצות לא שיחקו אחת נגד השנייה' : 'These teams did not face each other';
    srMeta.className = 'sr-meta sr-none';
    res.classList.add('show');
    return;
  }

  var nameH = he ? m.home.he : m.home.en;
  var nameA = he ? m.away.he : m.away.en;
  var stage = he ? WC.STAGE_HE[m.stage] : WC.STAGE_EN[m.stage];

  srTeams.innerHTML = WC.flagFor(m.home) + ' ' + esc(nameH) + '  ·  ' +
                      WC.flagFor(m.away) + ' ' + esc(nameA);

  if (m.status === 'future') {
    srScore.textContent = m.time;
    srMeta.textContent = (he ? 'טרם התרחש · ' : 'Not played yet · ') + stage + ' · ' + m.date;
    srMeta.className = 'sr-meta sr-none';
  } else {
    srScore.textContent = scoreLine(m);
    // Only a knockout winner advances; a group win is just a win.
    var extra = '';
    if (m.winner) {
      var w = m.winner === 'home' ? nameH : nameA;
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

  var he = curLang === 'he';
  box.innerHTML = todays.map(function(m) {
    var stage = he ? WC.STAGE_HE[m.stage] : WC.STAGE_EN[m.stage];
    var right, cls;
    if (m.status === 'live') {
      cls = 'tb live';
      right = '<div class="tb-score">' + scoreLine(m) + '</div><div class="tb-live">🔴 LIVE</div>';
    } else if (m.status === 'past') {
      cls = 'tb done';
      right = '<div class="tb-score">' + scoreLine(m) + '</div>' +
              '<div class="tb-sub" data-he="הסתיים" data-en="Full time">' + (he ? 'הסתיים' : 'Full time') + '</div>';
    } else {
      cls = 'tb up';
      right = '<div class="tb-time">' + m.time + '</div>' +
              '<div class="tb-sub tb-count" data-utc="' + m.utc.getTime() + '"></div>';
    }
    return '<div class="' + cls + '">' +
      '<div class="tb-tag" data-he="' + (m.status === 'past' ? 'היום' : 'המשחק של היום') + '" data-en="' +
        (m.status === 'past' ? 'Today' : "Today's match") + '">' +
        (he ? (m.status === 'past' ? 'היום' : 'המשחק של היום') : (m.status === 'past' ? 'Today' : "Today's match")) + '</div>' +
      '<div class="tb-main">' +
        '<span class="tb-team">' + WC.flagFor(m.home) + ' ' + esc(he ? m.home.he : m.home.en) + '</span>' +
        '<span class="tb-vs" data-he="נגד" data-en="vs">' + (he ? 'נגד' : 'vs') + '</span>' +
        '<span class="tb-team">' + WC.flagFor(m.away) + ' ' + esc(he ? m.away.he : m.away.en) + '</span>' +
      '</div>' +
      '<div class="tb-right">' + right + '</div>' +
      '<div class="tb-stage">' + esc(stage) + ' · ' + esc(m.venue) + '</div>' +
    '</div>';
  }).join('');

  tickCountdown();
  clearInterval(bannerTimer);
  bannerTimer = setInterval(tickCountdown, 30000);
}

function tickCountdown() {
  var he = curLang === 'he';
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

// ── DATA TAB (was the watch guide) ───────────────────────────────────
function renderDataTab() {
  var box = document.getElementById('watchTable');
  if (!box || !TOURNAMENT) return;
  var t = TOURNAMENT;
  var he = curLang === 'he';

  var played = t.all.filter(function(m) { return m.status === 'past'; });
  var goals = 0, biggest = null, shootouts = 0;
  played.forEach(function(m) {
    goals += m.score.h + m.score.a;
    if (m.pens) shootouts++;
    var diff = Math.abs(m.score.h - m.score.a);
    if (!biggest || diff > biggest.diff) biggest = { diff: diff, m: m };
  });

  // A team is still alive if it appears as a real side in any unplayed match.
  var alive = {};
  t.all.forEach(function(m) {
    if (m.status === 'past') return;
    if (!m.home.placeholder) alive[m.home.abbr] = m.home;
    if (!m.away.placeholder) alive[m.away.abbr] = m.away;
  });
  var aliveList = Object.keys(alive).map(function(k) { return alive[k]; });

  var counts = { safe: 0, warn: 0, danger: 0 };
  t.all.forEach(function(m) { counts[m.strip]++; });
  var left = { safe: 0, warn: 0, danger: 0 };
  WC.upcoming(t).forEach(function(m) { left[m.strip]++; });

  function stat(labelHe, labelEn, value) {
    return '<div class="ds"><div class="ds-v">' + value + '</div>' +
      '<div class="ds-l" data-he="' + labelHe + '" data-en="' + labelEn + '">' +
      (he ? labelHe : labelEn) + '</div></div>';
  }

  var avg = played.length ? (goals / played.length).toFixed(2) : '—';
  var html = '<div class="wt-wrap">';

  html += '<div class="ds-grid">' +
    stat('משחקים ששוחקו', 'Matches played', played.length + '/104') +
    stat('שערים', 'Goals', goals) +
    stat('ממוצע למשחק', 'Goals per match', avg) +
    stat('הכרעות בפנדלים', 'Shootouts', shootouts) +
    stat('קבוצות שנותרו', 'Teams left', aliveList.length) +
    stat('משחקים שנותרו', 'Matches left', WC.upcoming(t).length) +
    '</div>';

  if (biggest) {
    var bh = he ? biggest.m.home.he : biggest.m.home.en;
    var ba = he ? biggest.m.away.he : biggest.m.away.en;
    html += '<div class="wt-h" data-he="הניצחון הגדול ביותר" data-en="Biggest win">' +
      (he ? 'הניצחון הגדול ביותר' : 'Biggest win') + '</div>' +
      '<div class="ds-big">' + esc(bh) + ' <span class="wt-num">' + scoreLine(biggest.m) + '</span> ' + esc(ba) + '</div>';
  }

  if (aliveList.length && aliveList.length <= 12) {
    html += '<div class="wt-h" data-he="עדיין בפנים" data-en="Still in it">' + (he ? 'עדיין בפנים' : 'Still in it') + '</div>' +
      '<div class="ds-teams">' + aliveList.map(function(tm) {
        return '<span class="ds-chip">' + WC.flagFor(tm) + ' ' + esc(he ? tm.he : tm.en) + '</span>';
      }).join('') + '</div>';
  }

  var ROWS = [
    { k: 'safe',   he: 'שעה נוחה', en: 'Good hour',  hours: '06:00–23:59' },
    { k: 'warn',   he: 'מאוחר',     en: 'Late',       hours: '00:00–01:59' },
    { k: 'danger', he: 'לילה עמוק', en: 'Deep night', hours: '02:00–05:59' }
  ];
  html += '<div class="wt-h" data-he="נוחות שעות · כל הטורניר" data-en="Hour comfort · whole tournament">' +
    (he ? 'נוחות שעות · כל הטורניר' : 'Hour comfort · whole tournament') + '</div>' +
    '<table class="wt"><thead><tr>' +
    '<th data-he="קטגוריה" data-en="Category">' + (he ? 'קטגוריה' : 'Category') + '</th>' +
    '<th data-he="שעות" data-en="Hours">' + (he ? 'שעות' : 'Hours') + '</th>' +
    '<th data-he="סה״כ" data-en="Total">' + (he ? 'סה״כ' : 'Total') + '</th>' +
    '<th data-he="נשארו" data-en="Left">' + (he ? 'נשארו' : 'Left') + '</th></tr></thead><tbody>';
  ROWS.forEach(function(r) {
    html += '<tr><td><span class="wt-dot ' + r.k + '"></span>' +
      '<span data-he="' + r.he + '" data-en="' + r.en + '">' + (he ? r.he : r.en) + '</span></td>' +
      '<td class="wt-num">' + r.hours + '</td>' +
      '<td class="wt-num">' + counts[r.k] + '</td>' +
      '<td class="wt-num wt-left">' + (left[r.k] || '—') + '</td></tr>';
  });
  html += '</tbody></table>';

  var up = WC.upcoming(t);
  if (up.length) {
    html += '<div class="wt-h" data-he="נשארו לצפייה" data-en="Left to watch">' + (he ? 'נשארו לצפייה' : 'Left to watch') + '</div>' +
      '<table class="wt"><tbody>' + up.map(function(m) {
        var nh = he ? m.home.he : m.home.en;
        var na = he ? m.away.he : m.away.en;
        return '<tr><td class="wt-num">' + esc(m.date) + '</td><td class="wt-num">' + esc(m.time) + '</td>' +
          '<td><span class="wt-dot ' + m.strip + '"></span>' + esc(nh + ' – ' + na) + '</td>' +
          '<td class="wt-num">' + esc(he ? WC.STAGE_HE[m.stage] : WC.STAGE_EN[m.stage]) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  box.innerHTML = html + '</div>';
}

// ── LANGUAGE WRAPPER (rebuild dynamic content on switch) ──
var _origSetLang = setLang;
setLang = function(lang) {
  _origSetLang(lang);
  if (TOURNAMENT) {
    renderAll(TOURNAMENT);
    if (typeof window.renderBracket === 'function') window.renderBracket(TOURNAMENT);
  }
  resetTeamSearch();
  chatUpdateDir();
};

// ── AUTO STAR MARKS (FIFA top 10) ──


// ── AI CHAT ──
var CHAT_PROXY_URL = 'https://worldcup-ai.yoavstern1357.workers.dev';
var chatHistory = [];
var chatOpen = false;

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
      s += ' [LIVE ' + m.score.h + '-' + m.score.a + ']';
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

  return 'You are a helpful assistant for a FIFA World Cup 2026 live schedule page.\n' +
    'Answer concisely. Reply in the language the user writes (Hebrew or English).\n' +
    'Right now it is ' + nowIl.time + ' Israel time on ' + nowIl.dayLabelEn + ' (' + nowIl.dayKey + ').\n' +
    'All times below are Israel time (UTC+3).\n\n' +
    'TODAY\'S MATCHES:\n' + (todays.length ? todays.map(line).join('\n') : '  None') + '\n\n' +
    (live.length ? 'LIVE NOW:\n' + live.map(line).join('\n') + '\n\n' : '') +
    'UPCOMING (' + up.length + '):\n' + (up.length ? up.map(line).join('\n') : '  None — tournament over') + '\n\n' +
    'KNOCKOUT RESULTS SO FAR:\n' + (ko.length ? ko.map(line).join('\n') : '  None yet') + '\n\n' +
    'ELIMINATED IN KNOCKOUTS: ' + (eliminated.length ? eliminated.join(', ') : 'none') + '\n\n' +
    'Tournament: Jun 11 - Jul 19 2026 · USA / Canada / Mexico · 48 teams · 104 matches.\n' +
    'If asked about a team not listed as eliminated and not in an upcoming match, check the results above before answering.';
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
    var welcome = addChatBubble('assistant', curLang === 'he' ? heMsg : enMsg);
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
  if (panel) panel.setAttribute('dir', curLang === 'he' ? 'rtl' : 'ltr');
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

function sendChat() {
  var inp = document.getElementById('chatInputField');
  if (!inp) return;
  var text = inp.value.trim();
  if (!text) return;
  if (!CHAT_PROXY_URL) {
    addChatBubble('assistant', curLang === 'he'
      ? '⚠️ הצ\'אט עדיין לא מחובר.'
      : '⚠️ Chat not connected yet.');
    return;
  }
  inp.value = '';
  addChatBubble('user', text);
  chatHistory.push({ role: 'user', parts: [{ text: text }] });
  setChatTyping(true);
  var contents = chatHistory.slice(-10).map(function(m) {
    return { role: m.role, parts: m.parts || [{ text: m.content || '' }] };
  });
  fetch(CHAT_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildSystemPrompt() }] },
      contents: contents,
      // 512 was far too tight: gemini-2.5-flash thinks by default and its
      // thinking tokens come out of this same budget, so answers were cut
      // mid-word or came back with no text at all. The worker also enforces
      // a floor and switches thinking off; this just keeps the two in step.
      generationConfig: { maxOutputTokens: 2048 }
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    setChatTyping(false);

    var cand = (data.candidates && data.candidates[0]) || null;

    // Join every text part. Reading only parts[0] dropped the answer whenever
    // the model returned more than one chunk.
    var reply = '';
    if (cand && cand.content && cand.content.parts) {
      var parts = cand.content.parts;
      for (var i = 0; i < parts.length; i++) {
        if (parts[i] && typeof parts[i].text === 'string' && !parts[i].thought) {
          reply += parts[i].text;
        }
      }
    }
    reply = reply.trim();

    // A cut-off answer used to be rendered as if it were complete. Say so.
    if (reply && cand && cand.finishReason === 'MAX_TOKENS') {
      reply += curLang === 'he' ? '\n\n… (התשובה נקטעה)' : '\n\n… (answer was cut off)';
    }

    if (!reply) {
      var err = data.error || {};
      var quota = err.code === 429 || err.status === 'QUOTA_EXHAUSTED';
      var blocked = cand && cand.finishReason === 'SAFETY';
      var msg;
      if (quota) {
        msg = curLang === 'he'
          ? '⚠️ הצ\'אט עמוס כרגע (מכסת ה-API נגמרה). נסה שוב מאוחר יותר.'
          : '⚠️ Chat is out of API quota right now. Try again later.';
      } else if (blocked) {
        msg = curLang === 'he' ? '⚠️ התשובה נחסמה מטעמי בטיחות.' : '⚠️ The answer was blocked for safety.';
      } else if (cand && cand.finishReason === 'MAX_TOKENS') {
        msg = curLang === 'he'
          ? '⚠️ המודל חרג ממכסת האורך לפני שהספיק לענות. נסה לנסח שאלה קצרה יותר.'
          : '⚠️ The model ran out of length budget before answering. Try a shorter question.';
      } else {
        msg = curLang === 'he'
          ? ('⚠️ שגיאה' + (err.message ? ': ' + err.message : '.'))
          : ('⚠️ Error' + (err.message ? ': ' + err.message : '.'));
      }
      // Do NOT push errors into chatHistory -- an error bubble stored as a model
      // turn poisons the context of every later question.
      addChatBubble('assistant', msg);
      return;
    }

    chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    addChatBubble('assistant', reply);
  })
  .catch(function() {
    setChatTyping(false);
    addChatBubble('assistant', curLang === 'he'
      ? '⚠️ שגיאת חיבור.'
      : '⚠️ Connection error.');
  });
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
