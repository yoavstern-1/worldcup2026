// ══════════════════════════════════════════════════════
// bracket.js — knockout tree, rendered into #bracketBox
//
// Owns #bracketBox exclusively. It must never write to #recCards: buildRecs()
// in main.js re-renders that element on every refresh, and the old bracket
// lived there and was silently destroyed within seconds of every page load.
//
// The tree is wired from ESPN's placeholder refs ("Quarterfinal 2 Winner" ->
// qf[1]), not from array order. Array order is kickoff order, which is not
// bracket order.
// ══════════════════════════════════════════════════════
(function() {

var STYLE_ID = 'bk-style';

var CSS = ''
+ '.bk-wrap{width:100%;max-width:960px;margin:0 auto 14px;overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;padding:.5rem 0;direction:rtl;background:var(--card);border:1px solid var(--card-border);border-radius:var(--radius-sm);}'
+ '.bk{display:flex;align-items:stretch;min-width:840px;gap:0;padding:12px 8px;margin:0 auto;}'
+ '.bk-round{display:flex;flex-direction:column;justify-content:space-around;flex:1;min-width:104px;}'
+ '.bk-title{font-size:13px;font-weight:800;color:var(--t2);text-align:center;padding:2px 0 8px;letter-spacing:.5px;text-transform:uppercase;}'
+ '.bk-matches{display:flex;flex-direction:column;justify-content:space-around;flex:1;gap:3px;padding:0 3px;}'
+ '.bk-match{background:var(--card-future);border:1px solid var(--card-border);border-radius:6px;overflow:hidden;}'
+ '.bk-match.up{border-color:var(--hi-border);}'
+ '.bk-match.live{border-color:var(--live);box-shadow:0 0 0 1px var(--live);}'
+ '.bk-live{display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:800;color:var(--live);padding:3px 6px;border-top:1px solid var(--card-border);background:var(--live-soft);}'
+ '.bk-live .live-dot{width:6px;height:6px;}'
+ '.bk-live .bk-min{direction:ltr;unicode-bidi:isolate;}'
+ '.bk-team{display:flex;align-items:center;gap:4px;padding:4px 7px;font-size:11px;font-weight:600;color:var(--t2);min-height:22px;}'
// color-mix() needs Safari 16.2+. The rgba() line before each one is the
// fallback older iOS actually paints; without it the tint drops to transparent.
// Winner language matches the match card: a gold rail on the start edge, not a green fill.
// Green was doing double duty -- "convenient kickoff hour" in the legend AND "won" here --
// and gold ink/green fill meant the same "won" state was two different colours on two tabs.
+ '.bk-team.w{background:var(--hi);color:var(--t1);box-shadow:inset 3px 0 0 0 var(--gold);}'
+ '[dir="rtl"] .bk-team.w{box-shadow:inset -3px 0 0 0 var(--gold);}'
+ '.bk-team .bf{font-size:13px;flex-shrink:0;}'
+ '.bk-team .bn{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
+ '.bk-team .bs{font-size:15px;font-weight:800;margin-inline-start:auto;padding-inline-start:4px;color:var(--t1);direction:ltr;unicode-bidi:isolate;}'
+ '.bk-team .bp{font-size:11px;font-weight:700;color:var(--gold);padding-inline-start:3px;}'
+ '.bk-div{height:1px;background:var(--card-border);}'
+ '.bk-ph .bk-team{opacity:.55;}'
// 11px floor: Hebrew at 9px/400 in --t3 is a smudge, not a string. See .mc-grp in index.html.
+ '.bk-when{font-size:11px;font-weight:600;color:var(--t3);padding:3px 7px;text-align:center;border-top:1px solid var(--card-border);}'
+ '.bk-note{font-size:11px;font-weight:600;color:var(--gold);padding:2px 6px;}'
+ '.bk-conn{display:flex;flex-direction:column;justify-content:space-around;width:10px;flex-shrink:0;}'
+ '.bk-cx{position:relative;flex:1;}'
+ '.bk-cx.top{border-inline-end:1px solid var(--card-border);}'
+ '.bk-cx.top::after{content:"";position:absolute;inset-inline-end:0;bottom:0;width:10px;height:1px;background:var(--card-border);}'
+ '.bk-cx.bot{border-inline-end:1px solid var(--card-border);}'
+ '.bk-cx.bot::before{content:"";position:absolute;inset-inline-end:0;top:0;width:10px;height:1px;background:var(--card-border);}'
+ '.bk-ct{display:flex;flex-direction:column;justify-content:center;width:10px;flex-shrink:0;align-self:stretch;}'
+ '.bk-ct-line{position:relative;flex:1;border-inline-end:1px solid var(--card-border);}'
+ '.bk-ct-line::after{content:"";position:absolute;inset-inline-end:0;top:50%;width:10px;height:1px;background:var(--card-border);}'
+ '.bk-trophy-col{display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;width:96px;padding:0 4px;}'
/* The 3D canvas is taller than it is wide; reserve the box so swapping the SVG out for
   it does not shift the whole bracket sideways. */
+ '.bk-trophy-art{display:flex;align-items:center;justify-content:center;width:76px;height:97px;filter:drop-shadow(0 6px 18px rgba(217,184,102,.28));}'
+ '.bk-trophy-art canvas{display:block;}'
+ '.bk-trophy-lbl{font-size:11px;font-weight:700;color:var(--gold);text-align:center;margin-top:6px;line-height:1.4;}'
+ '.bk-stale{max-width:960px;margin:0 auto 8px;padding:7px 12px;border-radius:var(--radius-sm);background:rgba(251,191,36,.14);background:color-mix(in srgb,var(--warn) 14%,transparent);border:1px solid var(--warn);color:var(--warn);font-size:12px;font-weight:600;text-align:center;}'
+ '.bk-sched{max-width:960px;margin:0 auto;border-top:1px solid var(--card-border);padding-top:.75rem;}'
+ '.bk-sched-h{font-size:12px;font-weight:800;color:var(--t2);margin-bottom:8px;}'
+ '.bk-sched-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;}'
+ '.bk-sched-grid .bk-si{flex:1 1 230px;max-width:320px;}'
+ '.bk-si{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--card);border:1px solid var(--card-border);border-radius:6px;font-size:11px;}'
+ '.bk-si-date{color:var(--t3);min-width:36px;font-weight:600;direction:ltr;unicode-bidi:isolate;}'
+ '.bk-si-time{font-weight:700;color:var(--t1);min-width:44px;direction:ltr;unicode-bidi:isolate;}'
+ '.bk-when{direction:ltr;unicode-bidi:isolate;}'
+ '.bk-si-match{flex:1;color:var(--t2);}'
+ '.bk-badge{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:700;white-space:nowrap;}'
+ '.bk-badge.safe{background:rgba(74,222,128,.2);background:color-mix(in srgb,var(--safe) 20%,transparent);color:var(--safe);}'
+ '.bk-badge.warn{background:rgba(251,191,36,.2);background:color-mix(in srgb,var(--warn) 20%,transparent);color:var(--warn);}'
+ '.bk-badge.danger{background:rgba(251,113,133,.2);background:color-mix(in srgb,var(--danger) 20%,transparent);color:var(--danger);}'
+ '@keyframes bk-twinkle{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}'
+ '@media(max-width:600px){.bk{min-width:760px}.bk-trophy-col{width:64px}.bk-title{font-size:11px}}';

var TROPHY = '<svg width="52" height="52" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">'
  + '<defs><linearGradient id="bktg" x1="0%" y1="0%" x2="100%" y2="100%">'
  + '<stop offset="0%" stop-color="#FFE55C"/><stop offset="50%" stop-color="#FFA500"/><stop offset="100%" stop-color="#FFE55C"/></linearGradient>'
  + '<filter id="bkglow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
  + '<ellipse cx="32" cy="60" rx="16" ry="3.5" fill="rgba(255,200,0,.15)"/>'
  + '<rect x="21" y="51" width="22" height="4" rx="2" fill="url(#bktg)" filter="url(#bkglow)"/>'
  + '<rect x="25" y="44" width="14" height="9" rx="1.5" fill="url(#bktg)"/>'
  + '<path d="M17 7 Q15 28 26 37 Q29 39 32 39 Q35 39 38 37 Q49 28 47 7 Z" fill="url(#bktg)" filter="url(#bkglow)"/>'
  + '<path d="M17 7 Q8 7 8 18 Q8 27 17 30" stroke="#FFD700" stroke-width="3" fill="none" stroke-linecap="round"/>'
  + '<path d="M47 7 Q56 7 56 18 Q56 27 47 30" stroke="#FFD700" stroke-width="3" fill="none" stroke-linecap="round"/>'
  + '<ellipse cx="32" cy="22" rx="9" ry="3.5" fill="rgba(255,255,255,.2)"/>'
  + '</svg>';

var BADGE_HE = { safe: 'שעה נוחה', warn: 'מאוחר', danger: 'לילה עמוק' };
var BADGE_EN = { safe: 'Good hour', warn: 'Late', danger: 'Deep night' };

function isHe() { return document.documentElement.lang !== 'en'; }
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function teamName(team) { return isHe() ? team.he : team.en; }

function injectCSS() {
  if (document.getElementById(STYLE_ID)) return;   // the old code re-injected on every call
  var st = document.createElement('style');
  st.id = STYLE_ID;
  st.textContent = CSS;
  document.head.appendChild(st);
}

// ── Bracket wiring ───────────────────────────────────────────────────
// A competitor is either a placeholder pointing at the match that will fill it,
// or a real team that already won its way here. Both resolve to a feeder match.
function feederFor(t, team, prevStage) {
  if (team.ref && team.ref.stage === prevStage) {
    return WC.refMatch(t, team);
  }
  if (!team.placeholder) {
    var prev = t.stages[prevStage] || [];
    for (var i = 0; i < prev.length; i++) {
      var m = prev[i];
      var won = m.winner === 'home' ? m.home : (m.winner === 'away' ? m.away : null);
      if (won && won.abbr === team.abbr) return m;
    }
  }
  return null;
}

// The two matches that feed `match`, in [home-side, away-side] order.
function feeders(t, match, prevStage) {
  var a = feederFor(t, match.home, prevStage);
  var b = feederFor(t, match.away, prevStage);
  if (!a || !b) {
    console.warn('[bracket] could not resolve feeders for ' + match.stage +
                 '[' + match.bracketIndex + ']; falling back to chronological pairing');
    var prev = t.stages[prevStage] || [];
    var i = match.bracketIndex * 2;
    return [prev[i] || null, prev[i + 1] || null];
  }
  return [a, b];
}

// ── Cards ────────────────────────────────────────────────────────────
function teamRow(team, match, side) {
  var won = match.winner === side;
  var cls = 'bk-team' + (won ? ' w' : '');
  var html = '<div class="' + cls + '">';
  var flag = WC.flagFor(team);
  if (flag) html += '<span class="bf">' + flag + '</span>';
  html += '<span class="bn">' + esc(teamName(team)) + '</span>';
  if (match.score) {
    html += '<span class="bs">' + match.score[side === 'home' ? 'h' : 'a'] + '</span>';
    if (match.pens) html += '<span class="bp">(' + match.pens[side === 'home' ? 'h' : 'a'] + ')</span>';
  }
  return html + '</div>';
}

function matchCard(t, match) {
  if (!match) return placeholderCard();
  var cls = 'bk-match';
  if (match.status === 'future') cls += ' up';
  else if (match.status === 'live') cls += ' live';
  if (match.home.placeholder && match.away.placeholder) cls += ' bk-ph';

  var html = '<div class="' + cls + '">'
    + teamRow(match.home, match, 'home')
    + '<div class="bk-div"></div>'
    + teamRow(match.away, match, 'away');

  if (match.status === 'live') {
    var phase = WC.livePhase(match);
    var label = isHe() ? phase.he : phase.en;
    var minute = WC.liveMinute(match, t.fetchedAt);
    html += '<div class="bk-live"><span class="live-dot"></span>'
      + '<span class="bk-min live-min" data-live-id="' + esc(match.id) + '">'
      + esc(minute || label) + '</span>'
      + (minute ? '<span>· ' + esc(label) + '</span>' : '') + '</div>';
  } else if (match.status === 'future') {
    html += '<div class="bk-when">' + esc(match.date + ' · ' + match.time) + '</div>';
  } else if (match.note) {
    html += '<div class="bk-note">⚡ ' + esc(isHe() ? match.note.he : match.note.en) + '</div>';
  }
  return html + '</div>';
}

function placeholderCard() {
  return '<div class="bk-match bk-ph">'
    + '<div class="bk-team"><span class="bn">?</span></div>'
    + '<div class="bk-div"></div>'
    + '<div class="bk-team"><span class="bn">?</span></div>'
    + '</div>';
}

function conn(n) {
  var h = '', i;
  for (i = 0; i < n; i++) h += '<div class="bk-cx ' + (i % 2 === 0 ? 'top' : 'bot') + '"></div>';
  return '<div class="bk-conn">' + h + '</div>';
}
function connT() { return '<div class="bk-ct"><div class="bk-ct-line"></div></div>'; }

function round(titleHe, titleEn, cardsHtml) {
  return '<div class="bk-round">'
    + '<div class="bk-title" data-he="' + titleHe + '" data-en="' + titleEn + '">'
    + (isHe() ? titleHe : titleEn) + '</div>'
    + '<div class="bk-matches">' + cardsHtml + '</div></div>';
}

// ── Public ───────────────────────────────────────────────────────────
// The tree is drawn into every .bracket-box on the page — one sits at the top
// of each knockout tab (R16, QF, SF, Final), so the bracket is there whichever
// round the user is looking at, not only the round that happens to be current.
// The upcoming-fixtures list underneath it is printed once, in the first box.
function renderBracket(t) {
  var boxes = [].slice.call(document.querySelectorAll('.bracket-box'));
  var legacy = document.getElementById('bracketBox');
  if (legacy && boxes.indexOf(legacy) === -1) boxes.push(legacy);
  if (!boxes.length) { console.warn('[bracket] no .bracket-box found'); return; }
  if (!t || !t.stages) return;

  injectCSS();

  var qf = t.stages.qf, sf = t.stages.sf, fin = t.stages.final[0];
  if (qf.length < 4 || sf.length < 2) {
    boxes.forEach(function(b) { b.innerHTML = ''; });
    return;
  }

  // Left half feeds sf[0], right half feeds sf[1].
  var leftQF  = [qf[0], qf[1]];
  var rightQF = [qf[2], qf[3]];
  var leftR16  = feeders(t, qf[0], 'r16').concat(feeders(t, qf[1], 'r16'));
  var rightR16 = feeders(t, qf[2], 'r16').concat(feeders(t, qf[3], 'r16'));

  function cards(list) {
    return list.map(function(m) { return matchCard(t, m); }).join('');
  }

  var stale = '';
  if (t.stale) {
    stale = '<div class="bk-stale" data-he="נתונים מהמטמון — לא הצלחנו להתעדכן" '
          + 'data-en="Cached data — could not refresh">'
          + (isHe() ? 'נתונים מהמטמון — לא הצלחנו להתעדכן' : 'Cached data — could not refresh')
          + '</div>';
  }

  // The SVG goes in as the fallback. trophy3d.js swaps a real WebGL trophy into
  // .bk-trophy-art after render, and leaves this alone if it cannot.
  var finalDate = fin ? fin.date : '';
  var trophy = '<div class="bk-trophy-col">'
    + '<div class="bk-trophy-art">' + TROPHY + '</div>'
    + '<div class="bk-trophy-lbl"><span data-he="גמר" data-en="Final">' + (isHe() ? 'גמר' : 'Final') + '</span><br>' + esc(finalDate) + '</div>'
    + '</div>';

  var tree = '<div class="bk-wrap"><div class="bk">'
    + round('שמינית', 'Round of 16', cards(leftR16))
    + conn(4)
    + round('רבע גמר', 'Quarter-final', cards(leftQF))
    + conn(2)
    + round('חצי גמר', 'Semi-final', matchCard(t, sf[0]))
    + connT()
    + trophy
    + connT()
    + round('חצי גמר', 'Semi-final', matchCard(t, sf[1]))
    + conn(2)
    + round('רבע גמר', 'Quarter-final', cards(rightQF))
    + conn(4)
    + round('שמינית', 'Round of 16', cards(rightR16))
    + '</div></div>';

  // Upcoming list — derived, never a second hardcoded copy of the fixtures.
  // The 3rd-place play-off kicks off at 00:00 Israel time on 19/7, the final at 22:00
  // the same day, so plain chronological order puts the play-off before the final.
  // Force it last, same idea as finalTabOrder() in main.js.
  var up = WC.upcoming(t).slice().sort(function(a, b) {
    var rank = { third: 1 };
    var d = (rank[a.stage] || 0) - (rank[b.stage] || 0);
    return d || (a.utc - b.utc);
  });
  var sched = '';
  if (up.length) {
    sched = '<div class="bk-sched">'
      + '<div class="bk-sched-h" data-he="לוח משחקים קרובים" data-en="Upcoming matches">'
      + (isHe() ? 'לוח משחקים קרובים' : 'Upcoming matches') + '</div>'
      + '<div class="bk-sched-grid">'
      + up.map(function(m) {
          var badge = isHe() ? BADGE_HE[m.strip] : BADGE_EN[m.strip];
          return '<div class="bk-si">'
            + '<span class="bk-si-date">' + esc(m.date) + '</span>'
            + '<span class="bk-si-time">' + esc(m.time) + '</span>'
            + '<span class="bk-si-match">' + esc(teamName(m.home) + ' - ' + teamName(m.away)) + '</span>'
            + '<span class="bk-badge ' + m.strip + '">' + esc(badge) + '</span>'
            + '</div>';
        }).join('')
      + '</div></div>';
  }

  boxes.forEach(function(b, i) {
    b.innerHTML = stale + tree + (i === 0 ? sched : '');
  });

  mountTrophies();
}

// Upgrade the trophy to WebGL where trophy3d.js loaded and the device can do it.
// Only a VISIBLE tab gets a live canvas: there are four .bracket-box elements (one per
// knockout tab), and four spinning renderers would be four times the GPU work for three
// trophies nobody is looking at. Called again on tab change, hence the data-3d guard.
function mountTrophies() {
  if (typeof window.mountTrophy3D !== 'function') return;
  [].forEach.call(document.querySelectorAll('.bracket-box'), function(b) {
    var art = b.querySelector('.bk-trophy-art');
    if (!art || art.getAttribute('data-3d')) return;
    if (!b.offsetParent) return;                 // tab hidden — leave the SVG in place
    if (window.mountTrophy3D(art, 76)) art.setAttribute('data-3d', '1');
  });
}
window.mountTrophies = mountTrophies;

window.renderBracket = renderBracket;
window._bracketFeeders = feeders;   // exposed for tests

})();
