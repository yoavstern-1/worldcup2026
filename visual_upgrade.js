// ═══════════════════════════════════════════════════════════
// VISUAL UPGRADE PATCH — World Cup 2026 Mascots Edition
// ═══════════════════════════════════════════════════════════
(function() {

// ── 1. Load Exo 2 font ──
var link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=Exo+2:ital,wght@0,400;0,600;0,700;0,800;0,900;1,900&display=swap';
document.head.appendChild(link);

// ── 2. Inject CSS ──
var style = document.createElement('style');
style.textContent = `
body,button,input,select,.panel-opt,.drawer-item,.set-opt,.mc-team,.mc-venue,.mc-et,.leg-item,.sync-bar,.hero-sub,.hero-badge,.side-label,.set-label,.day-lbl,.mc-grp,.mc-fin,.mc-note,.mc-vs,.search-vs,.sr-teams,.sr-score,.sr-meta,.panel-title,.search-title,.info-box,.gs-tbl{font-family:'Exo 2','Inter',sans-serif !important;}

/* ══ CHAT FLOAT BUTTON — Pique the jaguar ══ */
#chatFloatBtn{background:transparent !important;border:none !important;box-shadow:none !important;width:68px !important;height:68px !important;padding:0 !important;font-size:0 !important;animation:chatFloat 3s ease-in-out infinite;bottom:20px !important;left:16px !important;}
#chatFloatBtn svg{width:68px;height:68px;filter:drop-shadow(0 4px 16px rgba(0,0,0,.5));transition:transform .22s cubic-bezier(.34,1.56,.64,1);}
#chatFloatBtn:hover{transform:scale(1) !important;}
#chatFloatBtn:hover svg{transform:scale(1.1) rotate(-4deg);}
@keyframes chatFloat{0%,100%{transform:translateY(0px);}50%{transform:translateY(-8px);}}

/* ══ CHAT PANEL ══ */
[data-theme="dark"] #chatPanel{background:#f0f4f1 !important;border-color:rgba(0,0,0,.15) !important;box-shadow:0 8px 32px rgba(0,0,0,.3) !important;}
[data-theme="dark"] #chatHeader{background:#1b5e20 !important;color:#fff !important;}
[data-theme="dark"] #chatMessages{background:#f0f4f1 !important;}
[data-theme="dark"] .chat-assistant{background:#dceee0 !important;color:#0f2417 !important;}
[data-theme="dark"] .chat-user{background:#1b5e20 !important;color:#fff !important;}
[data-theme="dark"] #chatInputField{background:#fff !important;border-color:#bbb !important;color:#0f2417 !important;}
[data-theme="dark"] #chatInputField::placeholder{color:#666 !important;}
[data-theme="dark"] #chatInputRow{background:#e4ede6 !important;border-top-color:rgba(0,0,0,.12) !important;}
[data-theme="dark"] #chatSendBtn{background:#1b5e20 !important;color:#fff !important;}
[data-theme="dark"] #chatTitle{color:#fff !important;}
[data-theme="dark"] #chatClose{color:#fff !important;}
[data-theme="dark"] .chat-typing span{background:#1b5e20 !important;}
[data-theme="light"] #chatPanel{background:#15401d !important;border-color:rgba(255,255,255,.18) !important;box-shadow:0 8px 32px rgba(0,0,0,.45) !important;}
[data-theme="light"] #chatHeader{background:#0a2410 !important;color:#ffd700 !important;}
[data-theme="light"] #chatMessages{background:#15401d !important;}
[data-theme="light"] .chat-assistant{background:#1d5429 !important;color:#d8efdc !important;}
[data-theme="light"] .chat-user{background:#4ade80 !important;color:#0a1a0e !important;}
[data-theme="light"] #chatInputField{background:#1d5429 !important;border-color:rgba(255,255,255,.25) !important;color:#e8f3ea !important;}
[data-theme="light"] #chatInputRow{background:#0a2410 !important;border-top-color:rgba(255,255,255,.1) !important;}
[data-theme="light"] #chatSendBtn{background:#ffd700 !important;color:#0a1a0e !important;}
[data-theme="light"] #chatTitle{color:#ffd700 !important;}
[data-theme="light"] #chatClose{color:#aaa !important;}
[data-theme="light"] .chat-typing span{background:#4ade80 !important;}

/* ══ MASCOT DECORATIONS on chat panel ══ */
.mascot-roo,.mascot-striker{
  position:fixed;bottom:86px;width:56px;height:76px;
  pointer-events:none;opacity:0;
  transition:opacity .4s ease, transform .4s cubic-bezier(.34,1.56,.64,1);
  transform:translateY(24px);z-index:198;
}
.mascot-roo{left:16px;}
.mascot-striker{left:88px;}
.mascot-roo.visible,.mascot-striker.visible{opacity:1;transform:translateY(0);}

/* ══ SPLASH SCREEN ══ */
#splashScreen{position:fixed;inset:0;z-index:9999;background:#06120a;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;}
#splashScreen.done{animation:splashOut .65s cubic-bezier(.4,0,.2,1) forwards;pointer-events:none;}
@keyframes splashOut{to{opacity:0;visibility:hidden;}}
#splashBalls{position:absolute;inset:0;pointer-events:none;}
.sball{position:absolute;border-radius:50%;background:radial-gradient(circle at 32% 32%, #fff 6%, #ddd 28%, #999 58%, #444 100%);box-shadow:inset -2px -2px 5px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.6);}
#splashTitle{position:relative;z-index:2;text-align:center;opacity:0;display:flex;flex-direction:column;align-items:center;user-select:none;}
#splashLine1{font-family:'Exo 2',sans-serif;font-size:clamp(44px,12vw,110px);font-weight:900;font-style:italic;color:#fff;letter-spacing:6px;text-transform:uppercase;line-height:1;text-shadow:0 0 40px rgba(255,255,255,.2);}
#splashLine2{font-family:'Exo 2',sans-serif;font-size:clamp(52px,15vw,140px);font-weight:900;color:#ffd700;letter-spacing:10px;line-height:1;display:block;margin-top:4px;text-shadow:0 0 60px rgba(255,215,0,.4);transform-origin:center center;}
`;
document.head.appendChild(style);

// ── SVG Mascots ──

// Pique — jaguar with green jersey (Mexico) — for chat button
var piqueSVG = `<svg viewBox="0 0 68 68" xmlns="http://www.w3.org/2000/svg">
  <!-- body -->
  <ellipse cx="34" cy="48" rx="14" ry="16" fill="#1b7e3c"/>
  <!-- jersey number -->
  <text x="34" y="52" text-anchor="middle" font-size="8" font-weight="bold" fill="#ffd700">11</text>
  <!-- legs -->
  <rect x="25" y="60" width="7" height="8" rx="3" fill="#e67e22"/>
  <rect x="36" y="60" width="7" height="8" rx="3" fill="#e67e22"/>
  <!-- cleats -->
  <ellipse cx="28.5" cy="68" rx="5" ry="2.5" fill="#222"/>
  <ellipse cx="39.5" cy="68" rx="5" ry="2.5" fill="#222"/>
  <!-- arms -->
  <ellipse cx="18" cy="46" rx="5" ry="7" rx2="3" fill="#e67e22" transform="rotate(-20 18 46)"/>
  <ellipse cx="50" cy="46" rx="5" ry="7" rx2="3" fill="#e67e22" transform="rotate(20 50 46)"/>
  <!-- neck -->
  <rect x="30" y="30" width="8" height="7" rx="3" fill="#d4894a"/>
  <!-- head -->
  <ellipse cx="34" cy="24" rx="15" ry="14" fill="#d4894a"/>
  <!-- jaguar spots on head -->
  <ellipse cx="26" cy="22" rx="3" ry="2" fill="#8B4513" opacity=".7"/>
  <ellipse cx="42" cy="22" rx="3" ry="2" fill="#8B4513" opacity=".7"/>
  <ellipse cx="34" cy="18" rx="2.5" ry="2" fill="#8B4513" opacity=".7"/>
  <!-- ears -->
  <ellipse cx="22" cy="13" rx="5" ry="6" fill="#d4894a"/>
  <ellipse cx="22" cy="13" rx="3" ry="4" fill="#e8a060"/>
  <ellipse cx="46" cy="13" rx="5" ry="6" fill="#d4894a"/>
  <ellipse cx="46" cy="13" rx="3" ry="4" fill="#e8a060"/>
  <!-- ear spots -->
  <ellipse cx="22" cy="11" rx="1.5" ry="1.5" fill="#8B4513" opacity=".6"/>
  <ellipse cx="46" cy="11" rx="1.5" ry="1.5" fill="#8B4513" opacity=".6"/>
  <!-- face white muzzle -->
  <ellipse cx="34" cy="27" rx="8" ry="6" fill="#f5deb3"/>
  <!-- nose -->
  <ellipse cx="34" cy="24" rx="3" ry="2" fill="#c0392b"/>
  <!-- eyes -->
  <ellipse cx="28" cy="20" rx="3" ry="3.5" fill="#fff"/>
  <ellipse cx="40" cy="20" rx="3" ry="3.5" fill="#fff"/>
  <circle cx="28.8" cy="20.5" r="2" fill="#1a6b2a"/>
  <circle cx="40.8" cy="20.5" r="2" fill="#1a6b2a"/>
  <circle cx="29.3" cy="19.8" r=".8" fill="#111"/>
  <circle cx="41.3" cy="19.8" r=".8" fill="#111"/>
  <circle cx="29.8" cy="19.3" r=".4" fill="#fff"/>
  <circle cx="41.8" cy="19.3" r=".4" fill="#fff"/>
  <!-- smile -->
  <path d="M29 29 Q34 33 39 29" stroke="#a0522d" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <!-- whisker dots -->
  <circle cx="27" cy="27" r=".8" fill="#8B4513"/>
  <circle cx="24" cy="28" r=".8" fill="#8B4513"/>
  <circle cx="41" cy="27" r=".8" fill="#8B4513"/>
  <circle cx="44" cy="28" r=".8" fill="#8B4513"/>
  <!-- headband -->
  <path d="M20 17 Q34 10 48 17" stroke="#ffd700" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;

// Roo — moose (Canada) red jersey — left side mascot
var rooSVG = `<svg viewBox="0 0 52 72" xmlns="http://www.w3.org/2000/svg">
  <!-- body -->
  <ellipse cx="26" cy="50" rx="12" ry="14" fill="#c0392b"/>
  <!-- legs -->
  <rect x="18" y="60" width="6" height="10" rx="3" fill="#8B4513"/>
  <rect x="28" y="60" width="6" height="10" rx="3" fill="#8B4513"/>
  <!-- hooves -->
  <ellipse cx="21" cy="70" rx="4" ry="2.5" fill="#333"/>
  <ellipse cx="31" cy="70" rx="4" ry="2.5" fill="#333"/>
  <!-- arms holding ball -->
  <ellipse cx="12" cy="48" rx="4" ry="7" fill="#8B4513" transform="rotate(-15 12 48)"/>
  <circle cx="10" cy="56" r="7" fill="#f5f5f5" stroke="#222" stroke-width="1"/>
  <polygon points="10,50 12,54 8,54" fill="#222" opacity=".7"/>
  <!-- other arm -->
  <ellipse cx="40" cy="48" rx="4" ry="7" fill="#8B4513" transform="rotate(15 40 48)"/>
  <!-- neck -->
  <rect x="22" y="33" width="8" height="7" rx="3" fill="#8B4513"/>
  <!-- head -->
  <ellipse cx="26" cy="26" rx="13" ry="13" fill="#8B4513"/>
  <!-- snout -->
  <ellipse cx="26" cy="31" rx="8" ry="6" fill="#a0652a"/>
  <!-- nose -->
  <ellipse cx="26" cy="28" rx="4" ry="3" fill="#5a2d0c"/>
  <ellipse cx="26" cy="27.5" rx="2" ry="1.5" fill="#000" opacity=".5"/>
  <!-- eyes -->
  <ellipse cx="20" cy="22" rx="3" ry="3.5" fill="#fff"/>
  <ellipse cx="32" cy="22" rx="3" ry="3.5" fill="#fff"/>
  <circle cx="20.8" cy="22.5" r="2" fill="#3d2b1f"/>
  <circle cx="32.8" cy="22.5" r="2" fill="#3d2b1f"/>
  <circle cx="21.3" cy="21.8" r=".7" fill="#fff"/>
  <circle cx="33.3" cy="21.8" r=".7" fill="#fff"/>
  <!-- ears -->
  <ellipse cx="14" cy="16" rx="4" ry="5" fill="#8B4513"/>
  <ellipse cx="38" cy="16" rx="4" ry="5" fill="#8B4513"/>
  <!-- antlers -->
  <path d="M14 14 L8 4 M8 4 L4 2 M8 4 L10 1" stroke="#6b3a1f" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M38 14 L44 4 M44 4 L48 2 M44 4 L42 1" stroke="#6b3a1f" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <!-- headband -->
  <path d="M14 19 Q26 13 38 19" stroke="#4ade80" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <!-- smile -->
  <path d="M21 32 Q26 36 31 32" stroke="#5a2d0c" stroke-width="1.5" fill="none" stroke-linecap="round"/>
</svg>`;

// Striker — eagle (USA) blue jersey — right side mascot
var strikerSVG = `<svg viewBox="0 0 52 72" xmlns="http://www.w3.org/2000/svg">
  <!-- body -->
  <ellipse cx="26" cy="50" rx="12" ry="14" fill="#1a56db"/>
  <!-- wings hint -->
  <ellipse cx="11" cy="47" rx="8" ry="5" fill="#8B7355" transform="rotate(-20 11 47)"/>
  <ellipse cx="41" cy="47" rx="8" ry="5" fill="#8B7355" transform="rotate(20 41 47)"/>
  <!-- legs -->
  <rect x="18" y="60" width="6" height="10" rx="2" fill="#e8a020"/>
  <rect x="28" y="60" width="6" height="10" rx="2" fill="#e8a020"/>
  <!-- talons -->
  <path d="M18 70 L14 73 M20 70 L20 74 M22 70 L24 73" stroke="#c47a10" stroke-width="2" stroke-linecap="round"/>
  <path d="M28 70 L24 73 M30 70 L30 74 M32 70 L34 73" stroke="#c47a10" stroke-width="2" stroke-linecap="round"/>
  <!-- neck -->
  <rect x="22" y="33" width="8" height="7" rx="3" fill="#fff"/>
  <!-- white collar -->
  <ellipse cx="26" cy="36" rx="8" ry="4" fill="#fff"/>
  <!-- head -->
  <ellipse cx="26" cy="24" rx="13" ry="13" fill="#8B7355"/>
  <!-- white head top -->
  <ellipse cx="26" cy="20" rx="11" ry="9" fill="#fff"/>
  <!-- beak -->
  <path d="M26 28 L32 30 L26 32 Z" fill="#e8a020"/>
  <!-- eyes -->
  <ellipse cx="19" cy="22" rx="4" ry="4" fill="#fff"/>
  <ellipse cx="33" cy="22" rx="4" ry="4" fill="#fff"/>
  <circle cx="19.5" cy="22.5" r="2.5" fill="#3a2800"/>
  <circle cx="33.5" cy="22.5" r="2.5" fill="#3a2800"/>
  <circle cx="20.2" cy="21.5" r=".9" fill="#fff"/>
  <circle cx="34.2" cy="21.5" r=".9" fill="#fff"/>
  <!-- eyebrow ridge -->
  <path d="M15 19 Q19 16 23 19" stroke="#555" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M29 19 Q33 16 37 19" stroke="#555" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- jersey number -->
  <text x="26" y="53" text-anchor="middle" font-size="7" font-weight="bold" fill="#fff">1</text>
</svg>`;

// ── 3. Replace chat button with Pique ──
var btn = document.getElementById('chatFloatBtn');
if (btn) btn.innerHTML = piqueSVG;

// ── 4. Add Roo & Striker — fixed position next to chat button ──
var rooEl = document.createElement('div');
rooEl.className = 'mascot-roo';
rooEl.innerHTML = rooSVG;
document.body.appendChild(rooEl);

var strikerEl = document.createElement('div');
strikerEl.className = 'mascot-striker';
strikerEl.innerHTML = strikerSVG;
document.body.appendChild(strikerEl);

// Show/hide mascots when chat opens/closes
var origToggle = window.toggleChat;
window.toggleChat = function() {
  if (origToggle) origToggle.apply(this, arguments);
  setTimeout(function() {
    var panel = document.getElementById('chatPanel');
    var isOpen = panel && panel.classList.contains('open');
    rooEl.classList.toggle('visible', isOpen);
    strikerEl.classList.toggle('visible', isOpen);
  }, 50);
};
var origClose = window.closeChat;
window.closeChat = function() {
  if (origClose) origClose.apply(this, arguments);
  rooEl.classList.remove('visible');
  strikerEl.classList.remove('visible');
};

// ── 5. Create splash screen ──
var splash = document.createElement('div');
splash.id = 'splashScreen';
splash.innerHTML = '<div id="splashBalls"></div><div id="splashTitle"><span id="splashLine1">WORLD CUP</span><span id="splashLine2">2026</span></div>';
document.body.insertBefore(splash, document.body.firstChild);

// ── 6. Splash animation ──
var BALL_COUNT = 100;
var ballsEl = document.getElementById('splashBalls');
var titleEl = document.getElementById('splashTitle');

for (var i = 0; i < BALL_COUNT; i++) {
  (function(idx) {
    var ball = document.createElement('div');
    ball.className = 'sball';
    var sz = (8 + Math.random() * 16) + 'px';
    ball.style.width = sz; ball.style.height = sz;
    ball.style.left = (44 + Math.random() * 12) + '%';
    ball.style.top  = (44 + Math.random() * 12) + '%';
    ball.style.opacity = '0';
    var tx = (Math.random() * 96) + '%';
    var ty = (Math.random() * 96) + '%';
    var delay = Math.random() * 500;
    var dur   = 350 + Math.random() * 500;
    ballsEl.appendChild(ball);
    setTimeout(function() {
      ball.style.transition = 'left '+dur+'ms cubic-bezier(.2,1.6,.4,1),top '+dur+'ms cubic-bezier(.2,1.6,.4,1),opacity 200ms';
      ball.style.opacity = '1';
      ball.style.left = tx; ball.style.top = ty;
      setTimeout(function() {
        ball.style.transition += ',opacity 300ms';
        ball.style.opacity = '0';
      }, delay + dur + 100 + Math.random() * 200);
    }, delay);
  })(i);
}

setTimeout(function() {
  titleEl.style.transition = 'opacity 400ms ease';
  titleEl.style.opacity = '1';
  var line2 = document.getElementById('splashLine2');
  if (line2) {
    line2.style.transition = 'none';
    line2.style.transform = 'scale(3) rotate(-180deg)';
    line2.style.opacity = '0';
    setTimeout(function() {
      line2.style.transition = 'transform 900ms cubic-bezier(.2,1.4,.4,1),opacity 600ms ease';
      line2.style.opacity = '1';
      line2.style.transform = 'scale(1) rotate(0deg)';
    }, 50);
  }
}, 400);

setTimeout(function() {
  splash.classList.add('done');
  setTimeout(function() { splash.style.display = 'none'; }, 700);
}, 2200);

})();
