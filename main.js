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
  document.querySelectorAll('.stage').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.drawer-item').forEach(function(d){ d.classList.remove('active'); });
  document.getElementById('stage-'+id).classList.add('active');
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

var TEAM_NORM_MAP = {
  'unitedstates':'usa','usa':'usa',
  'bosniaandherzegovina':'bosnia','bosnia':'bosnia',
  'southkorea':'korea','korea':'korea','republicofkorea':'korea',
  'cotedivoire':'ivorycoast','ivorycoast':'ivorycoast',
  'islamicrepublicofiran':'iran',
  'democraticrepublicofthecongo':'drcongo','congodr':'drcongo','drcongo':'drcongo',
  'trinidadandtobago':'trinidad',
  'czechrepublic':'czechia','czechia':'czechia',
  'northernireland':'northernireland',
  'newzealand':'newzealand',
  'saudiarabia':'saudiarabia',
  'capeverde':'capeverde',
  'centralafricanrepublic':'car',
  'antiguaandbarbuda':'antigua',
  'trinidadtobago':'trinidad',
  'papuanewguinea':'png',
};

function normTeam(name) {
  var n = (name || '').toLowerCase().replace(/[^a-z]/g, '');
  return TEAM_NORM_MAP[n] || n;
}

function buildMatchIndex() {
  matchIndex = {};
  document.querySelectorAll('.mc').forEach(function(card) {
    var teams = card.querySelectorAll('.mc-team span[data-en]');
    if (teams.length < 2) return;
    var t1 = normTeam(teams[0].getAttribute('data-en'));
    var t2 = normTeam(teams[1].getAttribute('data-en'));
    if (t1 && t2) {
      matchIndex[t1 + '_' + t2] = card;
      matchIndex[t2 + '_' + t1] = card;
    }
  });
}

function getUTCDateStrings() {
  var now = new Date();
  var results = [];
  for (var i = 0; i <= 2; i++) {
    var d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, '0');
    var day = String(d.getUTCDate()).padStart(2, '0');
    results.push('' + y + m + day);
  }
  return results;
}

function setSyncBar(state, text) {
  var btn = document.getElementById('btnRefresh');
  refreshTipText = text;
  if (state === 'loading') {
    if (btn) btn.classList.add('spinning');
  } else {
    if (btn) btn.classList.remove('spinning');
    if (btn) btn.textContent = (state === 'live') ? '🔴' : '↺';
  }
}

function ensureScoreEls(card) {
  var rt = card.querySelector('.mc-rt');
  if (!rt) return { scoreEl: null, finEl: null };
  var scoreEl = card.querySelector('.score');
  var finEl   = card.querySelector('.mc-fin');
  var timeEl  = card.querySelector('.mc-time');
  var etEl    = card.querySelector('.mc-et');
  if (!scoreEl) {
    scoreEl = document.createElement('div');
    scoreEl.className = 'score';
    scoreEl.style.display = 'none';
    rt.insertBefore(scoreEl, rt.firstChild);
  }
  if (!finEl) {
    finEl = document.createElement('div');
    finEl.className = 'mc-fin';
    finEl.style.display = 'none';
    rt.appendChild(finEl);
  }
  return { scoreEl: scoreEl, finEl: finEl, timeEl: timeEl, etEl: etEl };
}

function applyEventToCard(event) {
  var comp = event.competitions && event.competitions[0];
  if (!comp) return;
  var comps = comp.competitors || [];
  if (comps.length < 2) return;
  var home = comps.find(function(c){ return c.homeAway === 'home'; }) || comps[0];
  var away = comps.find(function(c){ return c.homeAway === 'away'; }) || comps[1];
  var t1n = normTeam(home.team.displayName);
  var t2n = normTeam(away.team.displayName);
  var card = matchIndex[t1n + '_' + t2n] || matchIndex[t2n + '_' + t1n];
  if (!card) return;
  var status = comp.status || {};
  var statusName = (status.type && status.type.name) || '';
  var els = ensureScoreEls(card);
  var scoreEl = els.scoreEl, finEl = els.finEl;
  var timeEl = els.timeEl, etEl = els.etEl;
  var liveTag = card.querySelector('.live-tag');
  var cardTeams = card.querySelectorAll('.mc-team span[data-en], .mc-team[data-en]');
  var cardT1 = cardTeams[0] ? normTeam(cardTeams[0].getAttribute('data-en')) : '';
  var homeFirst = (cardT1 === t1n);
  var scoreHome = home.score != null ? String(home.score) : '0';
  var scoreAway = away.score != null ? String(away.score) : '0';
  var scoreText = homeFirst ? (scoreHome + ' – ' + scoreAway) : (scoreAway + ' – ' + scoreHome);

  var isFinal = (
    statusName === 'STATUS_FULL_TIME' ||
    statusName === 'STATUS_FINAL' ||
    statusName === 'STATUS_FULL_TIME_AET' ||
    statusName === 'STATUS_FINAL_AET' ||
    statusName === 'STATUS_FINAL_PEN' ||
    (status.type && status.type.completed === true && status.type.state === 'post')
  );

  if (isFinal) {
    var suffix = '';
    if (statusName === 'STATUS_FULL_TIME_AET' || statusName === 'STATUS_FINAL_AET') {
      suffix = curLang === 'he' ? ' (א"ת)' : ' (AET)';
    } else if (statusName === 'STATUS_FINAL_PEN') {
      suffix = curLang === 'he' ? ' (פנד׳)' : ' (PEN)';
    }
    card.classList.remove('future', 'live');
    card.classList.add('past');
    if (timeEl) timeEl.style.display = 'none';
    if (etEl)   etEl.style.display = 'none';
    if (scoreEl) { scoreEl.textContent = scoreText; scoreEl.style.display = ''; }
    if (finEl)   { finEl.setAttribute('data-he','סיום' + suffix); finEl.setAttribute('data-en','FT' + suffix);
                   finEl.textContent = (curLang === 'he') ? ('סיום' + suffix) : ('FT' + suffix); finEl.style.display = ''; }
    if (liveTag) liveTag.remove();
  } else if (statusName === 'STATUS_IN_PROGRESS' || statusName === 'STATUS_HALFTIME') {
    card.classList.remove('past', 'future');
    card.classList.add('live');
    hasLiveGames = true;
    var clock = (statusName === 'STATUS_HALFTIME')
      ? 'HT'
      : ((status.displayClock || (status.type && status.type.detail)) || '');
    if (timeEl) timeEl.style.display = 'none';
    if (etEl)   etEl.style.display = 'none';
    if (scoreEl) { scoreEl.textContent = scoreText; scoreEl.style.display = ''; }
    if (finEl)   finEl.style.display = 'none';
    if (!liveTag) {
      liveTag = document.createElement('div');
      liveTag.className = 'live-tag';
      card.insertBefore(liveTag, card.firstChild);
    }
    liveTag.textContent = '🔴 ' + clock;
  } else if (statusName === 'STATUS_SCHEDULED') {
    card.classList.remove('past', 'live');
    card.classList.add('future');
    if (timeEl) timeEl.style.display = '';
    if (etEl)   etEl.style.display = '';
    if (scoreEl) scoreEl.style.display = 'none';
    if (finEl)   finEl.style.display = 'none';
    if (liveTag) liveTag.remove();
  }
}

function processAPIEvents(events) {
  events.forEach(applyEventToCard);
  lastFetchTime = Date.now();
  var timeStr = new Date().toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'});
  if (hasLiveGames) {
    setSyncBar('live', (curLang === 'he' ? '🔴 משחק חי · עדכון: ' : '🔴 Live now · Updated: ') + timeStr);
  } else {
    setSyncBar('ok', (curLang === 'he' ? 'עודכן: ' : 'Updated: ') + timeStr);
  }
  clearTimeout(liveRefreshTimer);
  liveRefreshTimer = setTimeout(fetchLiveData, hasLiveGames ? 60000 : 300000);
  buildRecs();
}

function fetchLiveData() {
  hasLiveGames = false;
  setSyncBar('loading', curLang === 'he' ? 'מעדכן נתונים...' : 'Fetching live data...');
  var dates = getUTCDateStrings();
  var pending = dates.length;
  var allEvents = [];
  dates.forEach(function(dateStr) {
    fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=' + dateStr)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.events) allEvents = allEvents.concat(data.events);
        if (--pending === 0) processAPIEvents(allEvents);
      })
      .catch(function() {
        if (--pending === 0) processAPIEvents(allEvents);
      });
  });
}

function manualRefresh() {
  clearTimeout(liveRefreshTimer);
  hideRefreshTip();
  fetchLiveData();
}

// ── TEAM SEARCH ──
var allTeams = [];
var teamMatchMap = {};

function buildTeamSearch() {
  var seen = {};
  allTeams = [];
  teamMatchMap = {};
  document.querySelectorAll('.mc').forEach(function(card) {
    var spans = card.querySelectorAll('.mc-team span[data-en]');
    if (spans.length < 2) return;
    var t = [spans[0], spans[1]];
    var norms = t.map(function(s){ return normTeam(s.getAttribute('data-en')); });
    var isReal = norms.every(function(n){ return n && !/^(1st|2nd|3rd|winner|loser)/i.test(n) && !/group[a-z]/i.test(n); });
    if (!isReal) return;
    t.forEach(function(s, i) {
      var enVal = s.getAttribute('data-en');
      var heVal = s.getAttribute('data-he') || enVal;
      var n = norms[i];
      if (!seen[n]) {
        seen[n] = true;
        allTeams.push({ en: enVal, he: heVal, norm: n });
      }
    });
    var key = norms[0] + '_' + norms[1];
    teamMatchMap[key] = card;
    teamMatchMap[norms[1] + '_' + norms[0]] = card;
  });
  allTeams.sort(function(a,b){ return a.en.localeCompare(b.en); });
  ['searchTeam1','searchTeam2'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var placeholder = id === 'searchTeam1'
      ? { he:'בחר קבוצה 1', en:'Team 1' }
      : { he:'בחר קבוצה 2', en:'Team 2' };
    sel.innerHTML = '<option value="" data-he="' + placeholder.he + '" data-en="' + placeholder.en + '">' +
      (curLang === 'he' ? placeholder.he : placeholder.en) + '</option>';
    allTeams.forEach(function(team) {
      var opt = document.createElement('option');
      opt.value = team.norm;
      opt.setAttribute('data-en', team.en);
      opt.setAttribute('data-he', team.he);
      opt.textContent = (curLang === 'he') ? team.he : team.en;
      sel.appendChild(opt);
    });
  });
}

function runTeamSearch() {
  var n1 = document.getElementById('searchTeam1').value;
  var n2 = document.getElementById('searchTeam2').value;
  var res = document.getElementById('searchResult');
  if (!n1 || !n2) { res.classList.remove('show'); return; }
  if (n1 === n2)  { res.classList.remove('show'); return; }
  var card = teamMatchMap[n1 + '_' + n2] || teamMatchMap[n2 + '_' + n1];
  if (!card) {
    document.getElementById('srTeams').textContent = '';
    document.getElementById('srScore').textContent = '';
    document.getElementById('srMeta').textContent =
      curLang === 'he' ? 'הקבוצות לא שיחקו אחת נגד השניה' : 'These teams did not face each other';
    document.getElementById('srMeta').className = 'sr-meta sr-none';
    res.classList.add('show');
    return;
  }
  var isPast  = card.classList.contains('past');
  var isLive  = card.classList.contains('live');
  if (!isPast && !isLive) {
    var timeEl = card.querySelector('.mc-time');
    var grpEl  = card.querySelector('.mc-grp');
    var timeStr = timeEl ? timeEl.textContent.trim() : '';
    var grpStr  = grpEl  ? grpEl.textContent.replace(/·/g,'').trim() : '';
    document.getElementById('srTeams').textContent = '';
    document.getElementById('srScore').textContent = '';
    document.getElementById('srMeta').textContent =
      (curLang === 'he'
        ? 'המשחק טרם התרחש · ' + grpStr + ' · ' + timeStr
        : 'Match not played yet · ' + grpStr + ' · ' + timeStr);
    document.getElementById('srMeta').className = 'sr-meta sr-none';
    res.classList.add('show');
    return;
  }
  var spans = card.querySelectorAll('.mc-team span[data-en]');
  var name1 = spans[0] ? (curLang==='he' ? spans[0].getAttribute('data-he') : spans[0].getAttribute('data-en')) : '';
  var name2 = spans[1] ? (curLang==='he' ? spans[1].getAttribute('data-he') : spans[1].getAttribute('data-en')) : '';
  var scoreEl = card.querySelector('.score');
  var score   = scoreEl ? scoreEl.textContent.trim() : (curLang==='he' ? 'מתעדכן...' : 'Updating...');
  var grpEl  = card.querySelector('.mc-grp');
  var grpStr = grpEl ? grpEl.textContent.replace(/·/g,'').trim() : '';
  document.getElementById('srTeams').textContent = name1 + '  ·  ' + name2;
  document.getElementById('srScore').textContent = score;
  document.getElementById('srMeta').textContent = grpStr;
  document.getElementById('srMeta').className = isLive ? 'sr-meta sr-live' : 'sr-meta';
  res.classList.add('show');
}

// ── RECOMMENDATIONS ──
var REC_MONTHS = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};

function parseDateENRec(str) {
  var m = (str || '').match(/([A-Z][a-z]{2})\s+(\d+)/);
  if (!m || !(m[1] in REC_MONTHS)) return null;
  return { month: REC_MONTHS[m[1]], day: parseInt(m[2], 10) };
}

function tagMatchDates() {
  document.querySelectorAll('.day-block').forEach(function(block) {
    var curDate = null;
    Array.from(block.childNodes).forEach(function(node) {
      if (!node.classList) return;
      if (node.classList.contains('day-hd')) {
        var lbl = node.querySelector('.day-lbl');
        if (lbl) {
          var d = parseDateENRec(lbl.getAttribute('data-en') || lbl.textContent);
          if (d) curDate = d;
        }
      } else if (node.classList.contains('mgrid') && curDate) {
        node.querySelectorAll('.mc').forEach(function(card) {
          if (!card.dataset.dt) {
            card.dataset.dt = '2026-' +
              String(curDate.month + 1).padStart(2, '0') + '-' +
              String(curDate.day).padStart(2, '0');
          }
        });
      }
    });
  });
  document.querySelectorAll('.mc:not([data-dt])').forEach(function(card) {
    card.querySelectorAll('.mc-grp span[data-en]').forEach(function(s) {
      if (card.dataset.dt) return;
      var d = parseDateENRec(s.getAttribute('data-en'));
      if (d) {
        card.dataset.dt = '2026-' +
          String(d.month + 1).padStart(2, '0') + '-' +
          String(d.day).padStart(2, '0');
      }
    });
  });
}

function buildRecs() {
  var recCards = document.getElementById('recCards');
  if (!recCards) return;
  recCards.innerHTML = '';
  var recSection = document.getElementById('stage-rec');
  var picks = [];
  var allCards = document.querySelectorAll('.mc');
  for (var i = 0; i < allCards.length && picks.length < 8; i++) {
    var card = allCards[i];
    if (recSection && recSection.contains(card)) continue;
    if (card.classList.contains('past') || card.classList.contains('live')) continue;
    var timeEl = card.querySelector('.mc-time');
    if (!timeEl) continue;
    var timeText = timeEl.textContent.trim();
    if (!/^\d{1,2}:\d{2}$/.test(timeText)) continue;
    var hour = parseInt(timeText.split(':')[0], 10);
    if (hour < 12 || hour > 22) continue;
    picks.push(card);
  }
  if (picks.length === 0) {
    var msg = document.createElement('p');
    msg.style.cssText = 'color:var(--t3);font-size:13px;padding:20px;text-align:center;';
    msg.setAttribute('data-he', 'אין משחקים בשעות נוחות בקרוב');
    msg.setAttribute('data-en', 'No convenient matches coming up');
    msg.textContent = curLang === 'en' ? 'No convenient matches coming up' : 'אין משחקים בשעות נוחות בקרוב';
    recCards.appendChild(msg);
    return;
  }
  var nowIsrael = new Date(Date.now() + 3 * 3600 * 1000);
  var todayMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var todayEnStr = todayMonths[nowIsrael.getUTCMonth()] + ' ' + nowIsrael.getUTCDate();
  picks.forEach(function(c) {
    var clone = c.cloneNode(true);
    clone.classList.remove('star');
    var starTag = clone.querySelector('.star-tag');
    if (starTag) starTag.remove();
    var grp = clone.querySelector('.mc-grp');
    if (grp) {
      grp.querySelectorAll('span[data-en]').forEach(function(sp) {
        if (sp.getAttribute('data-en') === todayEnStr) {
          sp.setAttribute('data-he', 'היום');
          sp.setAttribute('data-en', 'Today');
          sp.textContent = curLang === 'en' ? 'Today' : 'היום';
        }
      });
    }
    recCards.appendChild(clone);
  });
  recCards.querySelectorAll('[data-he]').forEach(function(el) {
    var val = el.getAttribute('data-' + curLang);
    if (val !== null) el.textContent = val;
  });
}

// ── LANGUAGE WRAPPER (rebuild dynamic content on switch) ──
var _origSetLang = setLang;
setLang = function(lang) {
  _origSetLang(lang);
  buildTeamSearch();
  buildRecs();
  runTeamSearch();
  chatUpdateDir();
};

// ── AUTO STAR MARKS (FIFA top 10) ──
function autoMarkStars() {
  var FIFA_TOP10 = [
    'france','england','brazil','argentina','portugal','spain',
    'netherlands','belgium','germany','italy'
  ].map(normTeam);
  document.querySelectorAll('.mc').forEach(function(card) {
    var teams = card.querySelectorAll('.mc-team span[data-en]');
    if (teams.length < 2) return;
    var t1 = normTeam(teams[0].getAttribute('data-en'));
    var t2 = normTeam(teams[1].getAttribute('data-en'));
    var isTop = FIFA_TOP10.indexOf(t1) !== -1 || FIFA_TOP10.indexOf(t2) !== -1;
    if (isTop) {
      card.classList.add('star');
      if (!card.querySelector('.star-tag')) {
        var tag = document.createElement('div');
        tag.className = 'star-tag';
        tag.setAttribute('data-he', '⭐ מומלץ');
        tag.setAttribute('data-en', '⭐ Pick');
        tag.textContent = curLang === 'en' ? '⭐ Pick' : '⭐ מומלץ';
        var strip = card.querySelector('.strip');
        if (strip && strip.nextSibling) {
          card.insertBefore(tag, strip.nextSibling);
        } else {
          card.insertBefore(tag, card.children[1] || card.firstChild);
        }
      }
    } else {
      card.classList.remove('star');
      var st = card.querySelector('.star-tag');
      if (st) st.remove();
    }
  });
}

// ────────────────────────────────────────────
// ── AI CHAT (Google Gemini via Cloudflare Worker proxy) ──
// ────────────────────────────────────────────
// The Gemini API key is NOT stored here. It lives as a secret inside a free
// Cloudflare Worker that proxies requests to Gemini. This keeps the key private
// and lets any visitor use the chat with zero setup.
//
// After you deploy the worker (see worker.js), paste its URL below, e.g.:
//   var CHAT_PROXY_URL = 'https://worldcup-ai.<your-subdomain>.workers.dev';
var CHAT_PROXY_URL = 'https://worldcup-ai.yoavstern1357.workers.dev';

var chatHistory = [];   // [{role, content}]
var chatOpen = false;

// נתונים חיים שנשלפו מה-Worker
var _liveScoresCache = { data: null, ts: 0 };

async function fetchLiveScoresFromWorker() {
  var now = Date.now();
  if (_liveScoresCache.data && (now - _liveScoresCache.ts) < 60000) return _liveScoresCache.data;
  try {
    var r = await fetch(CHAT_PROXY_URL + '/scores');
    var d = await r.json();
    _liveScoresCache = { data: d, ts: now };
    return d;
  } catch (e) {
    return null;
  }
}

function buildSystemPrompt(liveData) {
  var base = 'You are a helpful assistant for a FIFA World Cup 2026 live schedule page.\n' +
    'Answer questions concisely. Reply in the same language the user writes (Hebrew or English).\n' +
    'Today\'s date: ' + new Date().toLocaleDateString('en-GB') + '. All times are Israel time (UTC+3).\n' +
    'Tournament: Jun 11 – Jul 19 2026 · USA / Canada / Mexico · 48 teams · 104 matches.\n\n';

  if (liveData) {
    base += 'LIVE DATA (fetched now from ESPN):\n' + (liveData.scores || '') + '\n' + (liveData.football || '') + '\n';
  }

  // גם מה שנראה בדף
  var pageResults = [];
  document.querySelectorAll('.mc.past').forEach(function(card) {
    var teams = card.querySelectorAll('.mc-team span[data-en]');
    var score = card.querySelector('.score');
    if (teams.length >= 2 && score) {
      pageResults.push(teams[0].getAttribute('data-en') + ' ' + score.textContent.trim() + ' ' + teams[1].getAttribute('data-en'));
    }
  });
  if (pageResults.length) {
    base += 'PAGE GROUP STAGE RESULTS:\n' + pageResults.slice(-30).join('\n') + '\n';
  }

  return base;
}

function toggleChat() {
  chatOpen ? closeChat() : openChat();
}

var chatGreetingShown = false;  // הודעת ברוכים הבאים רק פעם אחת בסשן

function openChat() {
  chatOpen = true;
  var panel = document.getElementById('chatPanel');
  if (panel) panel.classList.add('open');
  var btn = document.getElementById('chatFloatBtn');
  if (btn) btn.classList.add('active');
  // הצג הודעת פתיחה רק פעם אחת בכל סשן — ונקה הודעות כפולות
  if (!chatGreetingShown) {
    chatGreetingShown = true;
    var msgs = document.getElementById('chatMessages');
    if (msgs) msgs.innerHTML = ''; // נקה כל בועות קיימות
    addChatBubble('assistant', curLang === 'he'
      ? 'שלום! אני יכול לענות על שאלות לגבי המונדיאל 2026 — תוצאות, לוח משחקים, קבוצות ועוד. שאל אותי!'
      : 'Hi! Ask me anything about the 2026 World Cup — results, schedule, groups, and more.');
  }
  setTimeout(function(){
    var inp = document.getElementById('chatInputField');
    if (inp) inp.focus();
  }, 300);
}

function closeChat() {
  // כיווץ בלבד — לא מוחק את השיחה
  chatOpen = false;
  var panel = document.getElementById('chatPanel');
  if (panel) panel.classList.remove('open');
  var btn = document.getElementById('chatFloatBtn');
  if (btn) btn.classList.remove('active');
}

// איפוס שיחה רק ברענון או סגירת טאב
window.addEventListener('beforeunload', function() {
  chatHistory = [];
  chatGreetingShown = false;
});

function chatUpdateDir() {
  var panel = document.getElementById('chatPanel');
  if (panel) panel.setAttribute('dir', curLang === 'he' ? 'rtl' : 'ltr');
}

function addChatBubble(role, text) {
  var msgs = document.getElementById('chatMessages');
  if (!msgs) return;
  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-' + role;
  bubble.textContent = text;
  msgs.appendChild(bubble);
  msgs.scrollTop = msgs.scrollHeight;
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

  // שלוף נתונים חיים תחילה, אחר כך שלח ל-Gemini
  fetchLiveScoresFromWorker().then(function(liveData) {
    return fetch(CHAT_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: buildSystemPrompt(liveData) }] },
        contents: contents,
        generationConfig: { maxOutputTokens: 512 }
      })
    });
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    setChatTyping(false);
    var reply = (data.candidates && data.candidates[0] &&
      data.candidates[0].content && data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || '';
    if (!reply) {
      var errMsg = data.error && data.error.message ? data.error.message : '';
      reply = curLang === 'he'
        ? ('⚠️ שגיאה מה-API' + (errMsg ? ': ' + errMsg : '.'))
        : ('⚠️ API error' + (errMsg ? ': ' + errMsg : '.'));
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

// Allow Enter key in chat input
document.addEventListener('DOMContentLoaded', function() {
  var inp = document.getElementById('chatInputField');
  if (inp) {
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
  }
});

// ── INIT ──
buildMatchIndex();
buildTeamSearch();
autoMarkStars();
buildRecs();
fetchLiveData();

// ══════════════════════════════════════════════════════════
// ── DYNAMIC MATCH BUILDER — builds all stages from ESPN ──
// ══════════════════════════════════════════════════════════

var ESPN_WC = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
var FOOTBALL_DATA_KEY = 'REDACTED_SEE_GIT_HISTORY_PURGE';

// Flag emojis
var FLAGS = {
  'MEX':'🇲🇽','ZAF':'🇿🇦','KOR':'🇰🇷','CZE':'🇨🇿','CAN':'🇨🇦','BIH':'🇧🇦','SUI':'🇨🇭','QAT':'🇶🇦',
  'BRA':'🇧🇷','MAR':'🇲🇦','SCO':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','HTI':'🇭🇹','USA':'🇺🇸','AUS':'🇦🇺','PAR':'🇵🇾','TUR':'🇹🇷',
  'GER':'🇩🇪','CIV':'🇨🇮','ECU':'🇪🇨','CUW':'🇨🇼','NED':'🇳🇱','JPN':'🇯🇵','SWE':'🇸🇪','TUN':'🇹🇳',
  'BEL':'🇧🇪','EGY':'🇪🇬','IRN':'🇮🇷','NZL':'🇳🇿','ESP':'🇪🇸','CPV':'🇨🇻','URU':'🇺🇾','KSA':'🇸🇦',
  'FRA':'🇫🇷','NOR':'🇳🇴','SEN':'🇸🇳','IRQ':'🇮🇶','ARG':'🇦🇷','AUT':'🇦🇹','DZA':'🇩🇿','JOR':'🇯🇴',
  'COL':'🇨🇴','POR':'🇵🇹','COD':'🇨🇩','UZB':'🇺🇿','ENG':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','CRO':'🇭🇷','GHA':'🇬🇭','PAN':'🇵🇦',
  'GHA':'🇬🇭','ALG':'🇩🇿',
};

var TEAM_HE = {
  'Mexico':'מקסיקו','South Africa':'דרום אפריקה','Korea Republic':'קוריאה','Czechia':'צ\'כיה',
  'Canada':'קנדה','Bosnia and Herzegovina':'בוסניה','Switzerland':'שוויץ','Qatar':'קטאר',
  'Brazil':'ברזיל','Morocco':'מרוקו','Scotland':'סקוטלנד','Haiti':'האיטי',
  'USA':'ארה"ב','Australia':'אוסטרליה','Paraguay':'פרגוואי','Turkiye':'טורקיה',
  'Germany':'גרמניה','Ivory Coast':'חוף השנהב','Ecuador':'אקוודור','Curacao':'קוראסאו',
  'Netherlands':'הולנד','Japan':'יפן','Sweden':'שוודיה','Tunisia':'תוניסיה',
  'Belgium':'בלגיה','Egypt':'מצרים','IR Iran':'איראן','New Zealand':'ניו זילנד',
  'Spain':'ספרד','Cape Verde':'קייפ ורד','Uruguay':'אורוגוואי','Saudi Arabia':'סעודיה',
  'France':'צרפת','Norway':'נורווגיה','Senegal':'סנגל','Iraq':'עיראק',
  'Argentina':'ארגנטינה','Austria':'אוסטריה','Algeria':'אלג\'יריה','Jordan':'ירדן',
  'Colombia':'קולומביה','Portugal':'פורטוגל','Congo DR':'קונגו DR','Uzbekistan':'אוזבקיסטן',
  'England':'אנגליה','Croatia':'קרואטיה','Ghana':'גאנה','Panama':'פנמה',
};

var VENUES_HE = {
  'SoFi Stadium':'SoFi Stadium, אינגלווד',
  'NRG Stadium':'NRG Stadium, יוסטון',
  'MetLife Stadium':'MetLife Stadium, ניו ג\'רזי',
  'AT&T Stadium':'AT&T Stadium, ארלינגטון',
  'Levi\'s Stadium':'Levi\'s Stadium, סנטה קלרה',
  'Gillette Stadium':'Gillette Stadium, פוקסבורו',
  'Rose Bowl':'Rose Bowl, פסדינה',
  'Lincoln Financial Field':'Lincoln Financial Field, פילדלפיה',
  'Hard Rock Stadium':'Hard Rock Stadium, מיאמי',
  'Mercedes-Benz Stadium':'Mercedes-Benz Stadium, אטלנטה',
  'Lumen Field':'Lumen Field, סיאטל',
  'BMO Field':'BMO Field, טורונטו',
  'BC Place':'BC Place, ונקובר',
  'Arrowhead Stadium':'Arrowhead Stadium, קנזס סיטי',
  'Estadio Azteca':'אצטדיון אזטקה, מקסיקו סיטי',
  'Estadio Akron':'אצטדיון אקרון, גוודלחרה',
  'Estadio BBVA':'Estadio BBVA, מונטריי',
};

function getFlag(abbr) { return FLAGS[abbr] || '🏳️'; }
function teamHe(name) { return TEAM_HE[name] || name; }
function venueHe(name) {
  for (var k in VENUES_HE) {
    if (name && name.indexOf(k) !== -1) return VENUES_HE[k];
  }
  return name || '';
}

// Convert UTC to Israel time string "HH:MM"
function toIsraelTime(utcStr) {
  var d = new Date(new Date(utcStr).getTime() + 3 * 3600000);
  return String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0');
}

function toIsraelDate(utcStr) {
  var d = new Date(new Date(utcStr).getTime() + 3 * 3600000);
  var days = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  var months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  var daysEn = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var monthsEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return {
    he: days[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + months[d.getUTCMonth()],
    en: daysEn[d.getUTCDay()] + ', ' + monthsEn[d.getUTCMonth()] + ' ' + d.getUTCDate(),
    key: d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0')
  };
}

function hourClass(timeStr) {
  var h = parseInt(timeStr.split(':')[0], 10);
  if (h >= 12 && h <= 22) return 'safe';
  if (h >= 23 || h <= 1) return 'warn';
  return 'danger';
}

// Build a match card HTML
function buildMatchCard(opts) {
  // opts: {status, home, away, homeAbbr, awayAbbr, score, timeStr, venue, group, isLive, clock, isFinal, suffix}
  var cls = 'mc';
  if (opts.isFinal) cls += ' past';
  else if (opts.isLive) cls += ' live';
  else cls += ' future';

  var hc = hourClass(opts.timeStr || '20:00');
  var strip = '<div class="strip ' + hc + '"></div>';
  var liveTag = opts.isLive ? '<div class="live-tag">🔴 ' + (opts.clock || '') + '</div>' : '';

  var scoreHTML = '';
  if (opts.isFinal || opts.isLive) {
    scoreHTML = '<div class="score">' + (opts.score || '? – ?') + '</div>';
    if (opts.isFinal) scoreHTML += '<div class="mc-fin" data-he="סיום' + (opts.suffix||'') + '" data-en="FT' + (opts.suffix||'') + '">סיום' + (opts.suffix||'') + '</div>';
  } else {
    scoreHTML = '<div class="mc-time ' + hc + '">' + (opts.timeStr||'') + '</div>';
    if (opts.etStr) scoreHTML += '<div class="mc-et">' + opts.etStr + '</div>';
  }

  var homeFlag = getFlag(opts.homeAbbr);
  var awayFlag = getFlag(opts.awayAbbr);
  var homeHe = teamHe(opts.home);
  var awayHe = teamHe(opts.away);

  var grpLabel = opts.group ? '<span data-he="' + (curLang==='he'?'בית':'Group') + '" data-en="Group">בית</span> ' + opts.group : (opts.roundLabel || '');

  var venueStr = opts.venue ? venueHe(opts.venue) : '';

  return '<div class="' + cls + '">' + strip + liveTag +
    '<div class="mc-top"><span class="mc-grp">' + grpLabel + '</span>' +
    '<div class="mc-rt">' + scoreHTML + '</div></div>' +
    '<div class="mc-teams">' +
    '<span class="mc-team">' + homeFlag + ' <span data-he="' + homeHe + '" data-en="' + opts.home + '">' + (curLang==='he'?homeHe:opts.home) + '</span></span>' +
    '<span class="mc-vs" data-he="נגד" data-en="vs">' + (curLang==='he'?'נגד':'vs') + '</span>' +
    '<span class="mc-team b">' + awayFlag + ' <span data-he="' + awayHe + '" data-en="' + opts.away + '">' + (curLang==='he'?awayHe:opts.away) + '</span></span>' +
    '</div>' +
    (venueStr ? '<div class="mc-venue">📍 <span data-he="' + venueStr + '" data-en="' + (opts.venue||'') + '">' + (curLang==='he'?venueStr:opts.venue||'') + '</span></div>' : '') +
    '</div>';
}

// Build standings table for one group
function buildGroupTable(group, rows) {
  var head = '<div class="gs-card"><div class="gs-title"><span data-he="בית" data-en="Group">בית</span> ' + group + '</div>' +
    '<table class="gs-tbl"><tr>' +
    '<th><span data-he="קבוצה" data-en="Team">קבוצה</span></th>' +
    '<th class="n"><span data-he="מ׳" data-en="P">מ׳</span></th>' +
    '<th class="n"><span data-he="נ" data-en="W">נ</span></th>' +
    '<th class="n"><span data-he="ת" data-en="D">ת</span></th>' +
    '<th class="n"><span data-he="ה" data-en="L">ה</span></th>' +
    '<th class="n"><span data-he="הפרש" data-en="GD">הפרש</span></th>' +
    '<th class="n"><span data-he="נק׳" data-en="Pts">נק׳</span></th>' +
    '</tr>';
  var body = rows.map(function(r, i) {
    var isQ = i < 2;
    var gd = (r.goalsFor || 0) - (r.goalsAgainst || 0);
    var gdStr = (gd > 0 ? '+' : '') + gd;
    var flag = getFlag(r.team && r.team.tla);
    var name = r.team ? (curLang==='he' ? teamHe(r.team.name) : r.team.name) : '?';
    return '<tr class="' + (isQ?'q':'') + '"><td><div class="tc">' +
      '<span class="pos ' + (isQ?'q':'') + '">' + r.position + '</span>' +
      flag + ' <span data-he="' + teamHe(r.team&&r.team.name||'') + '" data-en="' + (r.team&&r.team.name||'') + '">' + name + '</span>' +
      '</div></td>' +
      '<td class="n">' + r.playedGames + '</td>' +
      '<td class="n">' + r.won + '</td>' +
      '<td class="n">' + r.draw + '</td>' +
      '<td class="n">' + r.lost + '</td>' +
      '<td class="n gd">' + gdStr + '</td>' +
      '<td class="n">' + r.points + '</td></tr>';
  }).join('');
  return head + body + '</table></div>';
}

// Main dynamic builder
async function buildDynamicContent() {
  var loadingHTML = '<div style="text-align:center;padding:40px;color:var(--t3);font-size:14px;">⏳ ' +
    (curLang==='he' ? 'טוען נתונים...' : 'Loading live data...') + '</div>';

  // Set loading state on all stages
  ['stage-group','stage-standings','stage-rec','stage-r32','stage-r16','stage-qf','stage-sf','stage-final'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      var content = el.querySelector('.day-block, .stand-wrap, .rec-wrap, #recCards');
      if (content) content.innerHTML = loadingHTML;
    }
  });

  // Fetch from ESPN — multiple dates
  var dates = [];
  var now = Date.now();
  for (var i = 40; i >= -14; i--) {
    var d = new Date(now - i * 86400000);
    dates.push(d.toISOString().slice(0,10).replace(/-/g,''));
  }

  var allEvents = [];
  try {
    var fetches = dates.map(function(dt) {
      return fetch(ESPN_WC + '?dates=' + dt).then(function(r){return r.json();}).catch(function(){return {};});
    });
    var results = await Promise.all(fetches);
    results.forEach(function(data) {
      if (data.events) allEvents = allEvents.concat(data.events);
    });
  } catch(e) {}

  // Fetch standings from football-data.org
  var standingsData = null;
  var scorersData = null;
  try {
    var sRes = await fetch('https://api.football-data.org/v4/competitions/WC/standings?season=2026',
      {headers:{'X-Auth-Token': FOOTBALL_DATA_KEY}});
    if (sRes.ok) standingsData = await sRes.json();
    var scRes = await fetch('https://api.football-data.org/v4/competitions/WC/scorers?season=2026&limit=20',
      {headers:{'X-Auth-Token': FOOTBALL_DATA_KEY}});
    if (scRes.ok) scorersData = await scRes.json();
  } catch(e) {}

  // Process ESPN events
  var groupMatches = [];
  var knockoutMatches = [];

  allEvents.forEach(function(event) {
    var comp = event.competitions && event.competitions[0];
    if (!comp) return;
    var competitors = comp.competitors || [];
    if (competitors.length < 2) return;

    var home = competitors.find(function(c){return c.homeAway==='home';}) || competitors[0];
    var away = competitors.find(function(c){return c.homeAway==='away';}) || competitors[1];
    var status = comp.status && comp.status.type && comp.status.type.name || '';
    var isFinal = status==='STATUS_FULL_TIME'||status==='STATUS_FINAL'||
      status==='STATUS_FULL_TIME_AET'||status==='STATUS_FINAL_AET'||status==='STATUS_FINAL_PEN'||
      (comp.status&&comp.status.type&&comp.status.type.completed);
    var isLive = status==='STATUS_IN_PROGRESS'||status==='STATUS_HALFTIME';
    var suffix = '';
    if (status==='STATUS_FULL_TIME_AET'||status==='STATUS_FINAL_AET') suffix=' (א"ת)';
    else if (status==='STATUS_FINAL_PEN') suffix=' (פנד׳)';

    var homeScore = home.score != null ? home.score : '';
    var awayScore = away.score != null ? away.score : '';
    var scoreStr = (homeScore !== '' && awayScore !== '') ? homeScore + ' – ' + awayScore : '';

    var venueRaw = (comp.venue && comp.venue.fullName) || '';
    var timeStr = toIsraelTime(event.date);
    var dateInfo = toIsraelDate(event.date);

    // Detect group vs knockout by event notes/type
    var notes = event.notes || [];
    var groupName = '';
    notes.forEach(function(n) {
      var m = (n.headline||'').match(/Group ([A-L])/i);
      if (m) groupName = m[1].toUpperCase();
    });
    // Also check season/type
    var isKnockout = !groupName && (
      (event.season && event.season.type && event.season.type.type === 'post') ||
      event.name && /round|quarter|semi|final/i.test(event.name)
    );

    var matchObj = {
      id: event.id,
      date: event.date,
      dateInfo: dateInfo,
      timeStr: timeStr,
      home: home.team && home.team.displayName || '?',
      homeAbbr: home.team && home.team.abbreviation || '',
      away: away.team && away.team.displayName || '?',
      awayAbbr: away.team && away.team.abbreviation || '',
      score: scoreStr,
      isFinal: isFinal,
      isLive: isLive,
      suffix: suffix,
      clock: comp.status && comp.status.displayClock || '',
      venue: venueRaw,
      group: groupName,
      name: event.name || '',
    };

    if (groupName) groupMatches.push(matchObj);
    else knockoutMatches.push(matchObj);
  });

  // Sort by date
  groupMatches.sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  knockoutMatches.sort(function(a,b){return new Date(a.date)-new Date(b.date);});

  // ── BUILD GROUP STAGE ──
  var groupStage = document.getElementById('stage-group');
  if (groupStage) {
    // Group by day
    var byDay = {};
    var dayOrder = [];
    groupMatches.forEach(function(m) {
      var k = m.dateInfo.key;
      if (!byDay[k]) { byDay[k] = []; dayOrder.push(k); }
      byDay[k].push(m);
    });

    var html = '<div class="day-block">';
    dayOrder.forEach(function(k) {
      var dayMatches = byDay[k];
      var di = dayMatches[0].dateInfo;
      html += '<div class="day-hd"><div class="day-lbl" data-he="' + di.he + '" data-en="' + di.en + '">' +
        (curLang==='he'?di.he:di.en) + '</div><div class="day-line"></div></div><div class="mgrid">';
      dayMatches.forEach(function(m) {
        html += buildMatchCard(m);
      });
      html += '</div>';
    });
    html += '</div>';

    // Find the day-block container
    var db = groupStage.querySelector('.day-block');
    if (db) db.outerHTML = html;
    else groupStage.innerHTML += html;
  }

  // ── BUILD STANDINGS ──
  var standStage = document.getElementById('stage-standings');
  if (standStage && standingsData && standingsData.standings) {
    var gsGrid = standStage.querySelector('.gs-grid');
    if (gsGrid) {
      var standHTML = '';
      standingsData.standings.forEach(function(group) {
        if (group.table) standHTML += buildGroupTable(group.group || '?', group.table);
      });
      gsGrid.innerHTML = standHTML;
    }
  }

  // ── BUILD KNOCKOUT STAGES ──
  // Detect round by match name/count
  var r32=[],r16=[],qf=[],sf=[],final_=[];
  knockoutMatches.forEach(function(m) {
    var n = (m.name||'').toLowerCase();
    if (n.indexOf('round of 32')!==-1||n.indexOf('round of 48')!==-1) r32.push(m);
    else if (n.indexOf('round of 16')!==-1) r16.push(m);
    else if (n.indexOf('quarterfinal')!==-1||n.indexOf('quarter-final')!==-1) qf.push(m);
    else if (n.indexOf('semifinal')!==-1||n.indexOf('semi-final')!==-1) sf.push(m);
    else if (n.indexOf('final')!==-1) final_.push(m);
    else r32.push(m); // default to r32
  });

  function buildKnockoutSection(stageId, matches, labelHe, labelEn) {
    var stage = document.getElementById(stageId);
    if (!stage || !matches.length) return;
    var html = '<div class="day-block"><div class="mgrid">';
    matches.forEach(function(m) {
      var home = m.home || '?';
      var away = m.away || '?';
      // If TBD, show potential
      if (home === 'TBD' || home === '?' || home.indexOf('Winner')!==-1) {
        home = m.name ? m.name.split(' vs ')[0] || home : home;
      }
      html += buildMatchCard(m);
    });
    html += '</div></div>';
    var db = stage.querySelector('.day-block');
    if (db) db.outerHTML = html;
  }

  buildKnockoutSection('stage-r32', r32);
  buildKnockoutSection('stage-r16', r16);
  buildKnockoutSection('stage-qf', qf);
  buildKnockoutSection('stage-sf', sf);
  buildKnockoutSection('stage-final', final_);

  // ── BUILD RECOMMENDATIONS ──
  var recCards = document.getElementById('recCards');
  if (recCards) {
    var allMatchesSorted = groupMatches.concat(knockoutMatches)
      .sort(function(a,b){return new Date(a.date)-new Date(b.date);});

    // לייב תמיד ראשון, אחר כך עתידי בשעות נוחות
    var liveNow = allMatchesSorted.filter(function(m) { return m.isLive; });
    var upcoming = allMatchesSorted.filter(function(m) {
      if (m.isFinal || m.isLive) return false;
      var h = parseInt(m.timeStr, 10);
      return h >= 12 && h <= 22;
    });

    var picks = liveNow.concat(upcoming).slice(0, 8);

    if (!picks.length) {
      recCards.innerHTML = '<p style="color:var(--t3);font-size:13px;padding:20px;text-align:center;">' +
        (curLang==='he' ? 'אין משחקים בשעות נוחות בקרוב' : 'No convenient matches soon') + '</p>';
    } else {
      recCards.innerHTML = picks.map(function(m) {
        return buildMatchCard(m);
      }).join('');
    }
  }

  // ── SCORERS ──
  if (scorersData && scorersData.scorers) {
    // Store globally for chat
    window._wc2026Scorers = scorersData.scorers;
  }

  // Rebuild match index for live updates
  buildMatchIndex();
  attachRipple && document.querySelectorAll('.mc').forEach(attachRipple);

  console.log('Dynamic build complete:', groupMatches.length, 'group matches,', knockoutMatches.length, 'knockout matches');
}

// Run on load
document.addEventListener('DOMContentLoaded', function() {
  buildDynamicContent();
  // Refresh every 5 minutes
  setInterval(buildDynamicContent, 5 * 60 * 1000);
});

// ══════════════════════════════════════════════════════
// KNOCKOUT STAGE LIVE UPDATER
// Fetches real match data and updates knockout stages
// Falls back to static HTML if API fails
// ══════════════════════════════════════════════════════

var KO_DATA = {
  // Round of 16 — all completed
  r16: [
    { home:'🇦🇷 ארגנטינה', away:'🇨🇻 קייפ ורד', homeEn:'Argentina', awayEn:'Cape Verde', score:'3 – 2', time:'22:00', strip:'safe', date:'4/7', status:'past' },
    { home:'🇨🇴 קולומביה', away:'🇬🇭 גאנה', homeEn:'Colombia', awayEn:'Ghana', score:'1 – 0', time:'04:30', strip:'danger', date:'4/7', status:'past' },
    { home:'🇲🇦 מרוקו', away:'🇨🇦 קנדה', homeEn:'Morocco', awayEn:'Canada', score:'3 – 0', time:'20:00', strip:'safe', date:'4/7', status:'past' },
    { home:'🇫🇷 צרפת', away:'🇵🇾 פרגוואי', homeEn:'France', awayEn:'Paraguay', score:'1 – 0', time:'00:00', strip:'warn', date:'5/7', status:'past' },
    { home:'🇧🇷 ברזיל', away:'🇳🇴 נורווגיה', homeEn:'Brazil', awayEn:'Norway', score:'1 – 2', time:'23:00', strip:'safe', date:'5/7', status:'past', note:'הפתעה!' },
    { home:'🇲🇽 מקסיקו', away:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 אנגליה', homeEn:'Mexico', awayEn:'England', score:'2 – 3', time:'04:00', strip:'danger', date:'6/7', status:'past' },
    { home:'🇵🇹 פורטוגל', away:'🇪🇸 ספרד', homeEn:'Portugal', awayEn:'Spain', score:'0 – 1', time:'22:00', strip:'safe', date:'6/7', status:'past' },
    { home:'🇺🇸 ארה"ב', away:'🇧🇪 בלגיה', homeEn:'USA', awayEn:'Belgium', score:'1 – 4', time:'03:00', strip:'danger', date:'7/7', status:'past' },
    { home:'🇦🇷 ארגנטינה', away:'🇪🇬 מצרים', homeEn:'Argentina', awayEn:'Egypt', score:'3 – 2', time:'19:00', strip:'safe', date:'7/7', status:'past' },
    { home:'🇨🇭 שוויץ', away:'🇨🇴 קולומביה', homeEn:'Switzerland', awayEn:'Colombia', score:'0 – 0', time:'23:00', strip:'safe', date:'7/7', status:'past', note:'קולומביה עלתה בפנדלים' },
  ],
  // Quarter-finals — upcoming
  qf: [
    { home:'🇫🇷 צרפת', away:'🇲🇦 מרוקו', homeEn:'France', awayEn:'Morocco', time:'23:00', strip:'safe', date:'9/7', status:'future' },
    { home:'🇪🇸 ספרד', away:'🇧🇪 בלגיה', homeEn:'Spain', awayEn:'Belgium', time:'22:00', strip:'safe', date:'10/7', status:'future' },
    { home:'🇳🇴 נורווגיה', away:'🏴󠁧󠁢󠁥󠁮󠁧󠁿 אנגליה', homeEn:'Norway', awayEn:'England', time:'00:00', strip:'warn', date:'12/7', status:'future' },
    { home:'🇦🇷 ארגנטינה', away:'🇨🇭 שוויץ', homeEn:'Argentina', awayEn:'Switzerland', time:'04:00', strip:'danger', date:'12/7', status:'future' },
  ],
  // Semi-finals — TBD
  sf: [
    { home:'מנצחת צרפת/מרוקו', away:'מנצחת ספרד/בלגיה', homeEn:'Winner FRA/MAR', awayEn:'Winner ESP/BEL', time:'22:00', strip:'safe', date:'14/7', status:'future' },
    { home:'מנצחת נורווגיה/אנגליה', away:'מנצחת ארגנטינה/שוויץ', homeEn:'Winner NOR/ENG', awayEn:'Winner ARG/SUI', time:'22:00', strip:'safe', date:'15/7', status:'future' },
  ],
  // Final
  final: [
    { home:'מנצחת חצי 1', away:'מנצחת חצי 2', homeEn:'Winner SF1', awayEn:'Winner SF2', time:'22:00', strip:'safe', date:'19/7', status:'future' },
  ]
};

function buildKOCard(m) {
  var isPast = m.status === 'past';
  var cls = 'mc ' + (isPast ? 'past' : 'future');
  var scoreOrTime = isPast
    ? '<div class="score">' + m.score + '</div><div class="mc-fin" data-he="סיום" data-en="FT">סיום</div>'
    : '<div class="mc-time ' + m.strip + '">' + m.time + '</div>';
  return '<div class="' + cls + '">' +
    '<div class="strip ' + m.strip + '"></div>' +
    '<div class="mc-top">' +
      '<span class="mc-grp">' + m.date + '</span>' +
      '<div class="mc-rt">' + scoreOrTime + '</div>' +
    '</div>' +
    '<div class="mc-teams">' +
      '<span class="mc-team">' + m.home + '</span>' +
      '<span class="mc-vs" data-he="נגד" data-en="vs">נגד</span>' +
      '<span class="mc-team b">' + m.away + '</span>' +
    '</div>' +
    (m.note ? '<div class="mc-venue"><span class="mc-note">⚡ ' + m.note + '</span></div>' : '') +
    '</div>';
}

function updateKnockoutStages() {
  var stages = { 'stage-r16': 'r16', 'stage-qf': 'qf', 'stage-sf': 'sf', 'stage-final': 'final' };
  Object.keys(stages).forEach(function(stageId) {
    var key = stages[stageId];
    var stage = document.getElementById(stageId);
    if (!stage || !KO_DATA[key]) return;
    var db = stage.querySelector('.day-block');
    if (!db) return;
    db.innerHTML = '<div class="mgrid">' + KO_DATA[key].map(buildKOCard).join('') + '</div>';
    // Re-attach ripple
    db.querySelectorAll('.mc').forEach(attachRipple);
  });
}

// Run immediately on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateKnockoutStages);
} else {
  updateKnockoutStages();
}
