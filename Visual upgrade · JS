// ═══════════════════════════════════════════════════════════
// VISUAL UPGRADE PATCH — add before </body> in index.html
// Applies: Exo 2 font, SVG chat bot, chat theme inversion, splash screen
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
#chatFloatBtn{background:transparent !important;border:none !important;box-shadow:none !important;width:64px !important;height:64px !important;padding:0 !important;font-size:0 !important;animation:chatFloat 3s ease-in-out infinite;}
#chatFloatBtn svg{width:64px;height:64px;filter:drop-shadow(0 4px 14px rgba(0,0,0,.45));transition:transform .22s cubic-bezier(.34,1.56,.64,1);}
#chatFloatBtn:hover{transform:scale(1) !important;}
#chatFloatBtn:hover svg{transform:scale(1.12);}
@keyframes chatFloat{0%,100%{transform:translateY(0px);}50%{transform:translateY(-9px);}}
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

// ── 3. Replace chat button with SVG robot ──
var btn = document.getElementById('chatFloatBtn');
if (btn) {
  btn.innerHTML = '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="34" width="36" height="24" rx="10" fill="#1565c0"/><rect x="28" y="28" width="8" height="8" rx="3" fill="#0d47a1"/><circle cx="32" cy="20" r="14" fill="#f5f5f5" stroke="#222" stroke-width="1.2"/><polygon points="32,8 36,12 34,17 30,17 28,12" fill="#222" opacity=".85"/><polygon points="44,16 44,22 39,24 36,20 38,15" fill="#222" opacity=".85"/><polygon points="40,28 35,30 31,27 32,22 37,21" fill="#222" opacity=".85"/><polygon points="24,28 22,23 27,21 32,22 31,27" fill="#222" opacity=".85"/><polygon points="20,16 25,15 27,20 24,24 19,22" fill="#222" opacity=".85"/><circle cx="27" cy="19" r="2.2" fill="#1a73e8"/><circle cx="37" cy="19" r="2.2" fill="#1a73e8"/><circle cx="27.7" cy="18.3" r=".8" fill="#fff"/><circle cx="37.7" cy="18.3" r=".8" fill="#fff"/><path d="M27 24 Q32 28 37 24" stroke="#555" stroke-width="1.5" fill="none" stroke-linecap="round"/><rect x="4" y="37" width="12" height="6" rx="3" fill="#0d47a1"/><rect x="48" y="37" width="12" height="6" rx="3" fill="#0d47a1"/><ellipse cx="32" cy="35" rx="9" ry="3" fill="rgba(21,101,192,.25)"/></svg>';
}

// ── 4. Create splash screen ──
var splash = document.createElement('div');
splash.id = 'splashScreen';
splash.innerHTML = '<div id="splashBalls"></div><div id="splashTitle"><span id="splashLine1">WORLD CUP</span><span id="splashLine2">2026</span></div>';
document.body.insertBefore(splash, document.body.firstChild);

// ── 5. Run splash animation ──
var BALL_COUNT = 100;
var ballsEl = document.getElementById('splashBalls');
var titleEl = document.getElementById('splashTitle');

for (var i = 0; i < BALL_COUNT; i++) {
  (function(idx) {
    var ball = document.createElement('div');
    ball.className = 'sball';
    var sz = (10 + Math.random() * 16) + 'px';
    ball.style.width = sz; ball.style.height = sz;
    var cx = 44 + Math.random() * 12;
    var cy = 44 + Math.random() * 12;
    ball.style.left = cx + '%'; ball.style.top = cy + '%';
    ball.style.opacity = '0';
    var tx = (Math.random() * 96) + '%';
    var ty = (Math.random() * 96) + '%';
    var delay = Math.random() * 500;
    var dur = 350 + Math.random() * 500;
    ballsEl.appendChild(ball);
    setTimeout(function() {
      ball.style.transition = 'left '+dur+'ms cubic-bezier(.2,1.6,.4,1), top '+dur+'ms cubic-bezier(.2,1.6,.4,1), opacity 200ms';
      ball.style.opacity = '1';
      ball.style.left = tx; ball.style.top = ty;
      setTimeout(function() {
        ball.style.transition += ', opacity 300ms';
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
      line2.style.transition = 'transform 900ms cubic-bezier(.2,1.4,.4,1), opacity 600ms ease';
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
