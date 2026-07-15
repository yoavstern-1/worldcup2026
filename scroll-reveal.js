/* scroll-reveal.js — scroll-driven reveal + subtle depth layer.
 * Self-contained, no build step, no dependencies. Load with a plain <script src>.
 *
 * Public API:
 *   window.initScrollReveal()  — (re)scan the DOM for targets. Idempotent, safe to
 *                                call after every re-render (60s data refresh).
 *
 * Design notes:
 *  - All reveal/parallax state is written as INLINE styles / CSS custom properties,
 *    never as classes that set opacity or box-shadow. The site's own rules
 *    (.mc.past{opacity:.62}, .mc.live{box-shadow:...}, .mc:hover{transform:...})
 *    must keep winning, so we only compose through vars and a pseudo-element.
 *  - Glow lives on ::after so it never collides with the box-shadow the cards
 *    already declare, and it is built from --hi-border / --shadow so it tracks the
 *    light/dark theme automatically.
 */
(function () {
  'use strict';

  var STYLE_ID = 'sr-style';
  var MARK = 'srDone';            // dataset key -> data-sr-done
  var SEL = '.mc, .ds, .lb-row, .fx-i, .bk-match, .wt-h';

  var MAX_SHIFT = 14;             // px of parallax travel, hard cap — raised from 8 so the
                                 // depth movement on scroll is clearly visible, not a hint
  // Was 0.02. A non-integer scale renders the SCORE digits at a subpixel size, so the
  // numbers were softly blurred the entire time you scrolled — on a results site, the one
  // thing that must stay crisp. The translate parallax (integer px) does not blur; keep it.
  var MAX_SCALE = 0;              // scale delta, hard cap (0 = translate-only parallax)
  var GLOW_MS = 1100;            // how long the reveal ring lingers before easing away

  var revealObs = null;           // fires the reveal
  var depthObs = null;            // tracks who is on screen for the parallax
  var active = [];                // elements currently on screen
  var ticking = false;
  var listenersOn = false;

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      /* Composed transform: reveal lift (--sr-in-y) + parallax (--sr-y/--sr-s) + the
         hover lift (--sr-lift, set by :hover in index.html). All three ADD. A :hover
         rule that declared its own transform would out-specify this one and silently
         drop the parallax offset, so the card would jump on hover; the hover rules set
         a variable instead and land inside this same calc(). */
      '.sr-el{position:relative;',
      'transform:translateY(calc(var(--sr-in-y,0px) + var(--sr-y,0px) + var(--sr-lift,0px)))',
      ' scale(calc(var(--sr-s,1) * var(--sr-press,1)));',
      'transition:transform .28s cubic-bezier(.22,.61,.36,1),opacity .5s ease,',
      'box-shadow .35s ease,background .3s ease,border-color .3s ease;}',

      /* Glow ring. Inset shadows survive the overflow:hidden on .mc / .bk-match. */
      '.sr-el::after{content:"";position:absolute;inset:0;border-radius:inherit;',
      'pointer-events:none;opacity:0;transition:opacity .7s ease;',
      'box-shadow:inset 0 0 0 1px var(--hi-border),inset 0 0 18px -6px var(--hi-border),',
      '0 12px 30px -16px var(--shadow);}',
      '.sr-el.sr-glow::after{opacity:1;transition:opacity .25s ease;}',

      /* A boxed ring around a bare heading looks wrong — use an accent underline. */
      '.wt-h.sr-el::after{box-shadow:inset 0 -1px 0 0 var(--hi-border);}',

      /* Belt and braces: if the OS setting flips mid-session before JS reacts,
         nothing is left mid-animation or invisible. */
      '@media (prefers-reduced-motion: reduce){',
      '.sr-el{transform:none!important;transition:none!important;}',
      '.sr-el::after{display:none!important;}}'
    ].join('');
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  function show(el) {
    el.style.opacity = '';                       // hand opacity back to the stylesheet
    el.style.setProperty('--sr-in-y', '0px');
  }

  function hide(el) {
    el.style.opacity = '0';
    // Raised from 14px: a card rises further as it enters, so the reveal reads as a
    // deliberate motion effect rather than a barely-there settle.
    el.style.setProperty('--sr-in-y', '26px');
  }

  function reveal(el, delay) {
    if (el.dataset.srShown === '1') return;
    el.dataset.srShown = '1';
    window.setTimeout(function () {
      show(el);
      el.classList.add('sr-glow');
      window.setTimeout(function () { el.classList.remove('sr-glow'); }, GLOW_MS);
    }, delay || 0);
  }

  function revealAll() {
    var all = document.querySelectorAll(SEL);
    for (var i = 0; i < all.length; i++) {
      all[i].style.opacity = '';
      all[i].style.setProperty('--sr-in-y', '0px');
      all[i].style.setProperty('--sr-y', '0px');
      all[i].style.setProperty('--sr-s', '1');
    }
  }

  function onReveal(entries) {
    var shown = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e.isIntersecting) continue;
      reveal(e.target, Math.min(shown * 45, 220));  // light stagger within one batch
      shown++;
      revealObs.unobserve(e.target);                // one-shot
    }
  }

  function onDepth(entries) {
    for (var i = 0; i < entries.length; i++) {
      var el = entries[i].target;
      var at = active.indexOf(el);
      if (entries[i].isIntersecting) {
        if (at === -1) active.push(el);
      } else if (at !== -1) {
        active.splice(at, 1);
        el.style.setProperty('--sr-y', '0px');
        el.style.setProperty('--sr-s', '1');
      }
    }
    request();
  }

  function request() {
    if (ticking || !active.length) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  function update() {
    ticking = false;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var mid = vh / 2;
    var i, el;

    // Two passes on purpose: every read first, every write after, so the inline
    // style writes can't force a layout recalc for the next element's rect.
    var rects = [];
    for (i = 0; i < active.length; i++) {
      el = active[i];
      if (!el.isConnected) { rects.push(null); continue; }   // survived a re-render
      rects.push(el.getBoundingClientRect());
    }

    var dead = [];
    for (i = 0; i < active.length; i++) {
      el = active[i];
      var r = rects[i];
      if (!r) { dead.push(el); continue; }
      var d = ((r.top + r.height / 2) - mid) / mid;          // -1 top .. 0 centre .. 1 bottom
      if (d > 1) d = 1; else if (d < -1) d = -1;
      el.style.setProperty('--sr-y', (d * MAX_SHIFT).toFixed(2) + 'px');
      el.style.setProperty('--sr-s', (1 - Math.abs(d) * MAX_SCALE).toFixed(4));
    }

    for (i = 0; i < dead.length; i++) {
      var k = active.indexOf(dead[i]);
      if (k !== -1) active.splice(k, 1);
      if (depthObs) depthObs.unobserve(dead[i]);
    }
  }

  function onScroll() { request(); }

  function bindListeners() {
    if (listenersOn) return;
    listenersOn = true;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  function watchMotionPref() {
    if (!window.matchMedia) return;
    var mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    function onChange() {
      if (!mql.matches) return;
      if (revealObs) { revealObs.disconnect(); revealObs = null; }
      if (depthObs) { depthObs.disconnect(); depthObs = null; }
      active = [];
      revealAll();                                  // never strand content mid-fade
    }
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange);
  }

  function initScrollReveal() {
    try {
      injectStyle();

      // No IntersectionObserver (old Safari) or motion is unwelcome: final state, now.
      if (typeof window.IntersectionObserver !== 'function' || reduced()) {
        revealAll();
        return;
      }

      if (!revealObs) {
        revealObs = new IntersectionObserver(onReveal, {
          rootMargin: '0px 0px -8% 0px',
          threshold: 0.08
        });
      }
      if (!depthObs) {
        depthObs = new IntersectionObserver(onDepth, { rootMargin: '15% 0px' });
      }

      var els = document.querySelectorAll(SEL);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.dataset[MARK] === '1') continue;     // idempotent: never touch twice
        el.dataset[MARK] = '1';
        el.classList.add('sr-el');
        hide(el);
        revealObs.observe(el);
        depthObs.observe(el);
      }

      bindListeners();
      request();
    } catch (err) {
      // Any failure at all must end with readable content, not blank cards.
      try { revealAll(); } catch (e2) {}
    }
  }

  window.initScrollReveal = initScrollReveal;

  watchMotionPref();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initScrollReveal(); });
  } else {
    initScrollReveal();
  }
})();
