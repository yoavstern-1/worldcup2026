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
// ── AI CHAT (Claude / Anthropic) ──
// ────────────────────────────────────────────
// ⚠️  Replace the empty string below with your Anthropic API key.
//    Get one at https://console.anthropic.com → API Keys
//    Recommended: set a monthly spending limit in Billing settings.
var ANTHROPIC_KEY = '';

var chatHistory = [];   // [{role, content}]
var chatOpen = false;

function buildSystemPrompt() {
  var results = [];
  document.querySelectorAll('.mc.past').forEach(function(card) {
    var teams = card.querySelectorAll('.mc-team span[data-en]');
    var score = card.querySelector('.score');
    if (teams.length >= 2 && score) {
      results.push(teams[0].getAttribute('data-en') + ' ' + score.textContent.trim() + ' ' + teams[1].getAttribute('data-en'));
    }
  });

  var live = [];
  document.querySelectorAll('.mc.live').forEach(function(card) {
    var teams = card.querySelectorAll('.mc-team span[data-en]');
    var score = card.querySelector('.score');
    var liveTag = card.querySelector('.live-tag');
    if (teams.length >= 2) {
      live.push(teams[0].getAttribute('data-en') + ' ' + (score ? score.textContent.trim() : '?') +
        ' ' + teams[1].getAttribute('data-en') + (liveTag ? ' [' + liveTag.textContent + ']' : ''));
    }
  });

  var upcoming = [];
  document.querySelectorAll('.mc.future').forEach(function(card) {
    var teams = card.querySelectorAll('.mc-team span[data-en]');
    var time = card.querySelector('.mc-time');
    var grp = card.querySelector('.mc-grp');
    if (teams.length >= 2) {
      upcoming.push(
        (grp ? grp.textContent.trim() + ' ' : '') +
        teams[0].getAttribute('data-en') + ' vs ' + teams[1].getAttribute('data-en') +
        (time ? ' at ' + time.textContent.trim() + ' IL' : '')
      );
    }
  });

  return 'You are a helpful assistant for a FIFA World Cup 2026 live schedule page.\n' +
    'Answer questions concisely. Reply in the same language the user writes (Hebrew or English).\n' +
    'Today\'s date: ' + new Date().toLocaleDateString('en-GB') + '. All times are Israel time (UTC+3).\n\n' +
    (live.length ? 'LIVE NOW:\n' + live.join('\n') + '\n\n' : '') +
    'COMPLETED RESULTS (' + results.length + ' matches):\n' +
    (results.length ? results.join('\n') : 'None yet') + '\n\n' +
    'UPCOMING (next matches):\n' +
    (upcoming.slice(0, 15).join('\n') || 'None') + '\n\n' +
    'Tournament: Jun 11 – Jul 19 2026 · USA / Canada / Mexico · 48 teams · 104 matches.';
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
  if (chatHistory.length === 0) {
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

  if (!ANTHROPIC_KEY) {
    addChatBubble('assistant', curLang === 'he'
      ? '⚠️ לא הוגדר מפתח API. פתח את main.js והכנס את המפתח שלך ב-ANTHROPIC_KEY.'
      : '⚠️ No API key set. Open main.js and set your key in ANTHROPIC_KEY.');
    return;
  }

  inp.value = '';
  addChatBubble('user', text);
  chatHistory.push({ role: 'user', content: text });
  setChatTyping(true);

  var messages = chatHistory.slice(-10); // last 10 turns for context window

  fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: buildSystemPrompt(),
      messages: messages
    })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    setChatTyping(false);
    var reply = (data.content && data.content[0] && data.content[0].text) || '';
    if (!reply) {
      reply = curLang === 'he' ? 'שגיאה בתשובה מה-API.' : 'Error: empty response from API.';
    }
    chatHistory.push({ role: 'assistant', content: reply });
    addChatBubble('assistant', reply);
  })
  .catch(function(err) {
    setChatTyping(false);
    addChatBubble('assistant', curLang === 'he'
      ? '⚠️ שגיאת חיבור. בדוק שהמפתח תקין ושיש חיבור אינטרנט.'
      : '⚠️ Connection error. Check your API key and internet connection.');
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
