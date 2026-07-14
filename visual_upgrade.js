(function() {

// 1. Fonts (Sora + Assistant) are loaded in index.html <head>.

// 2. Inject CSS
var style = document.createElement('style');
style.textContent = `
body,button,input,select,.panel-opt,.drawer-item,.set-opt,.mc-team,.mc-venue,.mc-et,.leg-item,.sync-bar,.hero-sub,.hero-badge,.side-label,.set-label,.day-lbl,.mc-grp,.mc-fin,.mc-note,.mc-vs,.search-vs,.sr-teams,.sr-score,.sr-meta,.panel-title,.search-title,.info-box,.gs-tbl{font-family:'Sora','Assistant',sans-serif !important;}
#chatFloatBtn{background:transparent !important;border:none !important;box-shadow:none !important;width:56px !important;height:74px !important;padding:0 !important;font-size:0 !important;animation:chatFloat 3s ease-in-out infinite;bottom:calc(14px + env(safe-area-inset-bottom)) !important;left:calc(14px + env(safe-area-inset-left)) !important;display:flex !important;flex-direction:column !important;align-items:center !important;gap:2px !important;transition:opacity .25s ease,transform .25s ease;}
/* A fixed button always sits on top of content. Fade it out while the user is
   scrolling so it never blocks the card they are reading; bring it back at rest. */
#chatFloatBtn.scrolling{opacity:.18 !important;transform:translateY(6px) scale(.9) !important;pointer-events:none;}
#chat-ask-label{font-family:'Sora','Assistant',sans-serif;font-size:9px;font-weight:900;letter-spacing:1.2px;color:#d9b866;text-shadow:0 1px 8px rgba(0,0,0,.8);pointer-events:none;line-height:1;margin-bottom:2px;}
#chatFloatBtn svg{width:56px;height:56px;filter:drop-shadow(0 4px 16px rgba(0,0,0,.5));transition:transform .22s cubic-bezier(.34,1.56,.64,1);}
#chatFloatBtn:hover{transform:scale(1) !important;}
#chatFloatBtn:hover svg{transform:scale(1.1) rotate(-4deg);}
#chatPanel{bottom:calc(100px + env(safe-area-inset-bottom)) !important;}
@keyframes chatFloat{0%,100%{transform:translateY(0px);}50%{transform:translateY(-8px);}}
/* Chat colours now come from index.html theme vars — no overrides needed. */

#splashScreen{position:fixed;inset:0;z-index:9999;background:radial-gradient(120% 90% at 50% 38%, #0a1830 0%, #060a14 55%, #03060c 100%);display:flex;align-items:center;justify-content:center;overflow:hidden;}
#splashScreen.done{animation:splashOut .6s cubic-bezier(.4,0,.2,1) forwards;pointer-events:none;}
@keyframes splashOut{to{opacity:0;visibility:hidden;}}
#splashStage{position:relative;width:min(92vw,460px);aspect-ratio:1;display:flex;align-items:center;justify-content:center;}
#splashCanvas{position:absolute;inset:0;width:100%;height:100%;transition:opacity .4s ease;}

/* Sits below the goal so it never overlaps the ball in the net. */
#splashTitle{position:absolute;left:0;right:0;bottom:9%;z-index:3;text-align:center;display:flex;flex-direction:column;align-items:center;user-select:none;opacity:0;transform:translateY(16px);transition:opacity .55s ease,transform .6s cubic-bezier(.2,.8,.2,1);}
#splashTitle.in{opacity:1;transform:translateY(0);}
#splashLine1{font-family:'Sora','Assistant',sans-serif;font-size:clamp(26px,7.2vw,52px);font-weight:800;color:#fff;letter-spacing:.34em;text-indent:.34em;text-transform:uppercase;line-height:1;}
#splashRule{display:block;width:0;height:1px;background:linear-gradient(90deg,transparent,#d9b866,transparent);margin:14px 0 12px;transition:width .7s cubic-bezier(.2,.8,.2,1) .15s;}
#splashTitle.in #splashRule{width:min(64vw,320px);}
#splashLine2{font-family:'Sora','Assistant',sans-serif;font-size:clamp(30px,8.6vw,64px);font-weight:300;color:#d9b866;letter-spacing:.42em;text-indent:.42em;line-height:1;}
@media(max-width:520px){#splashRule{margin:10px 0 8px;}}
`;
document.head.appendChild(style);

// 3. Match-ball icon — an original drawing, not a traced product photo.
// Four-panel construction, three "la ola" wave panels in the host nations'
// colours, debossed line motifs inside each wave, white seams between.
// ids are prefixed so the icon and the splash can both live in one document.
function ballMarkup(p) {
  return [
    '<defs>',
      '<radialGradient id="' + p + '-surf" cx="36%" cy="28%" r="80%">',
        '<stop offset="0%" stop-color="#ffffff"/>',
        '<stop offset="62%" stop-color="#f6f8f9"/>',
        '<stop offset="90%" stop-color="#d2d8dc"/>',
        '<stop offset="100%" stop-color="#a7aeb3"/>',
      '</radialGradient>',
      '<radialGradient id="' + p + '-gloss" cx="32%" cy="24%" r="34%">',
        '<stop offset="0%" stop-color="#fff" stop-opacity=".9"/>',
        '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>',
      '</radialGradient>',
      '<clipPath id="' + p + '-clip"><circle cx="32" cy="32" r="29"/></clipPath>',
    '</defs>',

    '<circle cx="32" cy="32" r="29" fill="url(#' + p + '-surf)"/>',

    '<g clip-path="url(#' + p + '-clip)">',
      // ── RED wave, upper left
      '<path d="M4 6 C16 10 24 18 27 28 C22 33 14 34 3 31 C1 22 1 13 4 6 Z" fill="#d81e34"/>',
      '<path d="M7 12 C15 16 21 22 24 28" stroke="#8f1524" stroke-width="1" fill="none" opacity=".55"/>',
      '<path d="M5 19 C12 21 18 25 21 30" stroke="#8f1524" stroke-width="1" fill="none" opacity=".45"/>',
      '<path d="M10 8 C17 12 22 17 25 23" stroke="#f2647a" stroke-width=".7" fill="none" opacity=".5"/>',

      // ── BLUE wave, right
      '<path d="M36 27 C44 18 52 12 62 9 C66 18 66 30 62 40 C52 36 42 32 36 30 Z" fill="#1c86d6"/>',
      '<path d="M42 27 C49 21 55 17 61 15" stroke="#0d4f85" stroke-width="1" fill="none" opacity=".55"/>',
      '<path d="M44 31 C51 28 57 27 63 27" stroke="#0d4f85" stroke-width="1" fill="none" opacity=".45"/>',
      '<path d="M46 23 C52 19 57 16 62 14" stroke="#7cc6f2" stroke-width=".7" fill="none" opacity=".5"/>',

      // ── GREEN wave, bottom
      '<path d="M28 36 C30 46 30 55 26 64 L54 64 C58 54 56 44 50 38 C42 40 34 39 28 36 Z" fill="#1f9d4d"/>',
      '<path d="M32 41 C35 49 35 56 33 62" stroke="#0e5d2c" stroke-width="1" fill="none" opacity=".55"/>',
      '<path d="M40 41 C45 46 48 53 48 60" stroke="#0e5d2c" stroke-width="1" fill="none" opacity=".45"/>',
      '<path d="M36 43 C40 49 42 55 42 61" stroke="#74d69a" stroke-width=".7" fill="none" opacity=".5"/>',

      // ── white seams separating the panels, meeting at the centre
      '<path d="M32 32 C31 22 26 12 18 2"  stroke="#fff" stroke-width="4.6" fill="none" stroke-linecap="round"/>',
      '<path d="M32 32 C42 33 52 30 64 22" stroke="#fff" stroke-width="4.6" fill="none" stroke-linecap="round"/>',
      '<path d="M32 32 C28 40 27 52 30 64" stroke="#fff" stroke-width="4.6" fill="none" stroke-linecap="round"/>',

      // gold trophy accent where the three panels converge
      '<circle cx="32" cy="32" r="2.6" fill="none" stroke="#d9b23f" stroke-width="1.1"/>',
    '</g>',

    '<circle cx="32" cy="32" r="29" fill="url(#' + p + '-gloss)"/>',
    '<circle cx="32" cy="32" r="28.4" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="1.1"/>'
  ].join('');
}

var ballSVG = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' + ballMarkup('tb') + '</svg>';

// 4. Chat button becomes the ball, with ASK above it
var btn = document.getElementById('chatFloatBtn');
if (btn) {
  // data-he/data-en, not a bare textContent: setLang() only rewrites [data-he],
  // so a hardcoded string here is Latin script that survives into Hebrew mode.
  var label = document.createElement('span');
  label.id = 'chat-ask-label';
  label.setAttribute('data-he', 'שאל');
  label.setAttribute('data-en', 'ASK');
  label.textContent = (window.curLang === 'he' || document.documentElement.lang === 'he') ? 'שאל' : 'ASK';
  btn.innerHTML = ballSVG;
  btn.insertBefore(label, btn.firstChild);
}

// Mascots removed — the ball is the only character now.

// 7b. Fade the chat button while scrolling — it is fixed, so it would otherwise
// sit on top of whatever card is under it.
var scrollIdle = null;
window.addEventListener('scroll', function() {
  var b = document.getElementById('chatFloatBtn');
  if (!b || document.getElementById('chatPanel').classList.contains('open')) return;
  b.classList.add('scrolling');
  clearTimeout(scrollIdle);
  scrollIdle = setTimeout(function() { b.classList.remove('scrolling'); }, 400);
}, { passive: true });

// Splash is now WebGL — see splash3d.js (module). The 3D intro replaced the
// inline SVG version here.

})();

// Bracket moved to bracket.js — it now owns #bracketBox instead of fighting
// buildRecs() for #recCards, which silently destroyed it on every refresh.
