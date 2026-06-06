/* ═══════════════════════════════════════════════
   SLM Home Page, main.js
═══════════════════════════════════════════════ */

'use strict';

/* ═══════════════════════════════════════
   SMOOTH SCROLL (Lenis)
   — Inertia-based smooth wheel/keyboard scroll on desktop.
   — Native momentum preserved on touch devices.
   — Anchor clicks (#foo) are hijacked to glide-scroll.
   — Respects prefers-reduced-motion.
═══════════════════════════════════════ */
(function initSmoothScroll() {
  if (typeof Lenis === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),  // expo-out
    smoothWheel: true,
    smoothTouch: false,                 // keep native feel on phones/tablets
    wheelMultiplier: 1,
    touchMultiplier: 2,
    lerp: 0.1,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Expose for anchor links + back-to-top button
  window.__lenis = lenis;

  // Hijack in-page anchor links (<a href="#section">) for smooth scroll
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.length < 2) return;          // skip "#" and empty
    if (a.hasAttribute('data-no-lenis')) return;
    let target;
    try { target = document.querySelector(href); } catch (_) { return; }
    if (!target) return;
    e.preventDefault();
    const navH = window.innerWidth >= 1024 ? 88 : 72;
    lenis.scrollTo(target, { offset: -navH, duration: 1.4 });
  });

  // Back-to-top button — if the existing one uses window.scrollTo,
  // reroute it through Lenis so it glides instead of snapping.
  const backTop = document.getElementById('backTop');
  if (backTop) {
    backTop.addEventListener('click', function (e) {
      e.preventDefault();
      lenis.scrollTo(0, { duration: 1.6 });
    });
  }
})();

/* ═══════════════════════════════════════
   SPLIT-TEXT WORD REVEAL
   Finds every [data-split-words] element, splits its text nodes into
   individual <span class="split-word"> words (preserving child elements
   like accent spans and <br>) and gives each a staggered --split-delay
   so they rise into place one after another.
═══════════════════════════════════════ */
(function initSplitWords() {
  const targets = document.querySelectorAll('[data-split-words]');
  if (!targets.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function wrapWord(text) {
    const span = document.createElement('span');
    span.className = 'split-word';
    span.textContent = text;
    return span;
  }

  function split(el) {
    const words = [];
    const out = [];
    Array.from(el.childNodes).forEach(node => {
      if (node.nodeType === 3) {
        // Text node — split into words, keep whitespace as text nodes between them
        const parts = node.textContent.split(/(\s+)/);
        parts.forEach(part => {
          if (!part) return;
          if (part.trim()) {
            const w = wrapWord(part);
            out.push(w);
            words.push(w);
          } else {
            out.push(document.createTextNode(part));
          }
        });
      } else if (node.nodeType === 1) {
        if (node.tagName === 'BR') {
          out.push(node.cloneNode(false));
        } else {
          // Descend: split any text inside this child too (so accent words animate)
          node.classList.add('split-word');
          words.push(node);
          out.push(node);
        }
      }
    });
    el.innerHTML = '';
    out.forEach(n => el.appendChild(n));
    const baseDelay = parseFloat(el.dataset.splitDelay) || 0.1;
    const step      = parseFloat(el.dataset.splitStep)  || 0.06;
    words.forEach((w, i) => {
      w.style.setProperty('--split-delay', (baseDelay + i * step).toFixed(3) + 's');
    });
  }

  targets.forEach(split);
})();

/* ═══════════════════════════════════════
   MAGNETIC BUTTONS
   Any [data-magnetic] element translates toward the cursor while hovered,
   eased via lerp + RAF. Returns to origin on mouseleave with the CSS
   transition on [data-magnetic]. Disabled on touch devices.
═══════════════════════════════════════ */
(function initMagnetic() {
  return;   /* disabled — buttons stay static (no cursor-follow shake) */
  const targets = document.querySelectorAll('[data-magnetic]');
  if (!targets.length) return;
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function bind(el) {
    const STRENGTH = parseFloat(el.dataset.magneticStrength) || 0.28;
    const MAX      = parseFloat(el.dataset.magneticMax)      || 14;   // px cap
    let raf = null;
    let tx = 0, ty = 0;
    let targetX = 0, targetY = 0;

    function tick() {
      tx += (targetX - tx) * 0.18;
      ty += (targetY - ty) * 0.18;
      el.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
      if (Math.abs(targetX - tx) > 0.05 || Math.abs(targetY - ty) > 0.05) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    }
    function queue() { if (!raf) raf = requestAnimationFrame(tick); }

    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width  / 2)) * STRENGTH;
      const dy = (e.clientY - (r.top  + r.height / 2)) * STRENGTH;
      targetX = Math.max(-MAX, Math.min(MAX, dx));
      targetY = Math.max(-MAX, Math.min(MAX, dy));
      // During mousemove, bypass CSS transition for responsiveness
      el.style.transition = 'transform 0.12s cubic-bezier(0.2, 0.9, 0.2, 1)';
      queue();
    });

    el.addEventListener('mouseleave', () => {
      targetX = 0;
      targetY = 0;
      // Restore the smooth return-to-origin transition
      el.style.transition = '';
      queue();
    });
  }

  targets.forEach(bind);
})();

/* ═══════════════════════════════════════
   SITE LOADER — shows once per session on first page load.
   Plays the brand video full-length, then fades out.
   Hides on the <video> ended event; hard 12s fallback in case the
   video stalls or autoplay is blocked.
═══════════════════════════════════════ */
(function siteLoader() {
  const loader = document.getElementById('siteLoader');
  if (!loader) return;

  // If already shown in this session, skip immediately.
  try {
    if (sessionStorage.getItem('slm-loader-done') === '1') {
      loader.classList.add('no-show');
      return;
    }
  } catch (_) { /* sessionStorage blocked; just show it */ }

  let hidden = false;
  function hide() {
    if (hidden) return;
    hidden = true;
    loader.classList.add('is-hidden');
    try { sessionStorage.setItem('slm-loader-done', '1'); } catch (_) {}
    setTimeout(() => loader.remove(), 700);
  }

  const video = loader.querySelector('video');
  if (video) {
    // Play through fully, then fade out
    video.addEventListener('ended', hide, { once: true });
    // If autoplay is blocked or the file errors, fall back to a short window
    video.addEventListener('error', () => setTimeout(hide, 1500), { once: true });
    // Try to start playback (some browsers need an explicit play() after JS loads)
    const playPromise = video.play && video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => setTimeout(hide, 1500));
    }
  } else {
    // No video element — just hide after window load
    if (document.readyState === 'complete') setTimeout(hide, 1300);
    else window.addEventListener('load', () => setTimeout(hide, 1300));
  }

  // Hard fallback: don't hold visitors hostage if something stalls
  setTimeout(hide, 12000);
})();

// ── AOS
// On mobile (< lg), swap any horizontal slide animations
// (fade-right / fade-left) to fade-up so the on-scroll reveals match
// the rest of the site instead of feeling sideways-jumpy on narrow
// screens. Runs before AOS.init() so the swapped attribute is what
// AOS reads when it indexes elements.
if (window.matchMedia('(max-width: 1023px)').matches) {
  document
    .querySelectorAll('[data-aos="fade-right"], [data-aos="fade-left"]')
    .forEach(el => el.setAttribute('data-aos', 'fade-up'));
}
AOS.init({ once: true, duration: 680, easing: 'ease-out-quad', offset: 55 });

/* ═══════════════════════════════════════
   NAV, scroll + mobile
═══════════════════════════════════════ */
const navbar  = document.getElementById('navbar');
const backTop = document.getElementById('backTop');

let _navLastY = window.scrollY;
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  // Only home toggles transparent <-> scrolled; sub-pages stay solid (is-subpage marker set by chrome.js)
  if (navbar && !navbar.classList.contains('is-subpage')) {
    navbar.classList.toggle('scrolled', y > 60);
  }
  // Auto-hide on scroll down, reveal on scroll up / near the top
  if (navbar) {
    const menuOpen = mobileMenu && !mobileMenu.classList.contains('hidden');
    // Mobile: nav stays visible. Desktop: hide on scroll-down, reveal on scroll-up / near top.
    if (window.innerWidth < 1024 || menuOpen || y <= 140 || y < _navLastY - 4) {
      navbar.classList.remove('nav-hidden');
    } else if (y > _navLastY + 4) {
      navbar.classList.add('nav-hidden');
    }
  }
  _navLastY = y;
  if (backTop) backTop.classList.toggle('is-visible', y > 500);
}, { passive: true });

// Reveal the nav when the cursor moves near the top of the viewport
window.addEventListener('mousemove', (e) => {
  if (navbar && e.clientY < 80) navbar.classList.remove('nav-hidden');
}, { passive: true });

/* ═══════════════════════════════════════
   IMAGE FADE-IN, graceful lazy-load reveal
═══════════════════════════════════════ */
(function imageLoadPolish() {
  function mark(img) {
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('is-loaded');
    } else {
      img.addEventListener('load',  () => img.classList.add('is-loaded'), { once: true });
      img.addEventListener('error', () => img.classList.add('is-loaded'), { once: true });
    }
  }
  // Observe existing
  document.querySelectorAll('img[loading="lazy"]').forEach(mark);
  // Watch for JS-injected images (overlays)
  const mo = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG' && node.loading === 'lazy') mark(node);
        else if (node.querySelectorAll) node.querySelectorAll('img[loading="lazy"]').forEach(mark);
      });
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();

// Mobile menu toggle
const menuBtn   = document.getElementById('menuBtn');
const mobileMenu= document.getElementById('mobileMenu');
const iconBar   = document.getElementById('iconBar');
const iconClose = document.getElementById('iconClose');

if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', () => {
    const isNowOpen = mobileMenu.classList.toggle('hidden') === false;
    if (iconBar)   iconBar.classList.toggle('hidden',  isNowOpen);
    if (iconClose) iconClose.classList.toggle('hidden', !isNowOpen);
  });
}

window.closeMenu = function () {
  if (mobileMenu) mobileMenu.classList.add('hidden');
  if (iconBar)    iconBar.classList.remove('hidden');
  if (iconClose)  iconClose.classList.add('hidden');
};

/* Auto-close mobile menu when ANY link inside it is tapped
   + handle expandable sub-groups (Projects → 6 categories) */
if (mobileMenu) {
  mobileMenu.addEventListener('click', e => {
    // Toggle expandable group (don't close menu)
    const toggle = e.target.closest('.mm-group-toggle');
    if (toggle) {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      return;
    }
    // Any link → close menu (links within the menu navigate)
    if (e.target.closest('a')) window.closeMenu();
  });
}

/* ═══════════════════════════════════════
   THEME TOGGLE (light / dark)
═══════════════════════════════════════ */
(function themeToggle() {
  const root = document.documentElement;
  const btn  = document.getElementById('themeToggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    if (isDark) {
      root.removeAttribute('data-theme');
      localStorage.setItem('slm-theme', 'light');
    } else {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('slm-theme', 'dark');
    }
  });
})();

/* ═══════════════════════════════════════
   CYCLING WORD, "We Build [X]"
   Uses inline style transitions, no CSS class conflicts.
   Robust against tab-switching: tracks pending timers and resets the
   element to a clean visible state when the tab regains focus, so
   the animation never gets "stuck" mid-transition.
═══════════════════════════════════════ */
const WORDS   = ['Industrial', 'Hospitality', 'Institutional', 'Commercial', 'Residential', 'Public Works', 'Trust'];
const wordEl  = document.getElementById('cyclingWord');
const catRows = document.querySelectorAll('.cat-row');
let   wordIdx = 0;
let   wbStepTimer = 0;
let   wbOutTimer  = 0;

// Map word index → cat row index (Trust has no row, maps to -1 = all off)
const CAT_MAP = [0, 1, 2, 3, 4, 5, -1];

function setTransition(el, val) {
  el.style.transition = val;
}

function highlightCat(idx) {
  catRows.forEach((r, i) => r.classList.toggle('active', i === idx));
}

function cycleOut(done) {
  setTransition(wordEl, 'transform 0.32s cubic-bezier(0.4,0,1,1), opacity 0.28s ease');
  wordEl.style.transform = 'translateY(-55px)';
  wordEl.style.opacity   = '0';
  clearTimeout(wbOutTimer);
  wbOutTimer = setTimeout(done, 330);
}

function cycleIn() {
  // Snap to bottom instantly (no transition)
  setTransition(wordEl, 'none');
  wordEl.style.transform = 'translateY(55px)';
  wordEl.style.opacity   = '0';

  // Force reflow so the snap is applied before we animate
  void wordEl.offsetHeight;

  // Now animate in
  setTransition(wordEl, 'transform 0.42s cubic-bezier(0,0,0.2,1), opacity 0.38s ease');
  wordEl.style.transform = 'translateY(0)';
  wordEl.style.opacity   = '1';
}

function scheduleNext() {
  clearTimeout(wbStepTimer);
  const isTrust = WORDS[wordIdx] === 'Trust';
  wbStepTimer = setTimeout(step, isTrust ? 2800 : 1900);
}

function step() {
  cycleOut(() => {
    wordIdx = (wordIdx + 1) % WORDS.length;
    wordEl.textContent = WORDS[wordIdx];
    highlightCat(CAT_MAP[wordIdx]);
    cycleIn();
    scheduleNext();
  });
}

// Reset to a clean visible state and restart the cycle from the
// current word. Used on init and after the tab regains focus.
function wbResume() {
  if (!wordEl) return;
  clearTimeout(wbStepTimer);
  clearTimeout(wbOutTimer);
  setTransition(wordEl, 'none');
  wordEl.textContent     = WORDS[wordIdx];
  wordEl.style.transform = 'translateY(0)';
  wordEl.style.opacity   = '1';
  void wordEl.offsetHeight;
  highlightCat(CAT_MAP[wordIdx]);
  scheduleNext();
}

if (wordEl) {
  wbResume();
  // If the tab is hidden and comes back, animations + setTimeout drift
  // can leave the word stuck (translateY(-55px), opacity 0, etc.). Reset.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(wbStepTimer);
      clearTimeout(wbOutTimer);
    } else {
      wbResume();
    }
  });
}

/* ═══════════════════════════════════════
   COUNTER ANIMATION, Facts & Figures
═══════════════════════════════════════ */
function animateCount(el) {
  const target   = parseInt(el.dataset.target, 10);
  const suffix   = el.dataset.suffix || '';
  let   count    = 0;
  const interval = target <= 10 ? Math.max(100, Math.floor(900 / target)) : 20;
  const step     = target <= 10 ? 1 : Math.max(1, Math.ceil(target / 60));
  const timer    = setInterval(() => {
    count = Math.min(count + step, target);
    el.textContent = count + suffix;
    if (count >= target) clearInterval(timer);
  }, interval);
}

const countObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCount(e.target);
      countObs.unobserve(e.target);
    }
  });
}, { threshold: 0.6 });

document.querySelectorAll('.counter[data-target]').forEach(el => countObs.observe(el));

/* ═══════════════════════════════════════
   FLAGSHIP — SCROLL STACK REVEAL (clip-path wipe)
   Pinned stage; stacked images are wiped away from the right via
   clip-path: inset(0 X% 0 0) to reveal the one beneath. Mirrors the
   reference: progress → stage(N-1) → smoothstep local → per-card crop,
   orange edge marker, caption swap, counter, segmented progress bar.
═══════════════════════════════════════ */
(function initFlagshipHScroll() {
  const wrap = document.getElementById('flagship');
  if (!wrap || !wrap.classList.contains('ph-wrap')) return;
  const stage = wrap.querySelector('.ph-stage');
  const track = document.getElementById('phTrack');
  if (!stage || !track) return;

  const dots = Array.from(wrap.querySelectorAll('.ph-dot'));
  const N = dots.length || 1;
  let curDot = 0;

  const isMobile = () => window.matchMedia('(max-width: 1023px)').matches;
  let raf = 0;
  function update() {
    raf = 0;
    if (isMobile()) { track.style.transform = ''; return; }   // native swipe on mobile
    const total = wrap.offsetHeight - window.innerHeight;
    const scrolled = Math.min(Math.max(-wrap.getBoundingClientRect().top, 0), total);
    const p = total > 0 ? scrolled / total : 0;
    const maxX = Math.max(0, track.scrollWidth - stage.clientWidth);
    track.style.transform = `translate3d(${(-p * maxX).toFixed(1)}px, 0, 0)`;
    const idx = Math.round(p * (N - 1));
    if (idx !== curDot) {
      curDot = idx;
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
    }
  }
  // click a dot → smooth-scroll to that card's position in the pin
  dots.forEach((d, i) => d.addEventListener('click', () => {
    const total = wrap.offsetHeight - window.innerHeight;
    const targetP = N > 1 ? i / (N - 1) : 0;
    window.scrollTo({ top: wrap.offsetTop + targetP * total, behavior: 'smooth' });
  }));
  function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();

/* ═══════════════════════════════════════
   WE BUILD — scroll-expand card. Pins (sticky) and grows from an inset
   rounded card to full-bleed as you scroll; releases into the founder
   section once fully expanded.
═══════════════════════════════════════ */
(function initWeExpand() {
  const wrap = document.getElementById('we-build');
  if (!wrap || !wrap.classList.contains('we-expand')) return;
  const card = document.getElementById('weCard');
  if (!card) return;

  const W0 = 64,  W1 = 100;   // width % (card is full viewport height; only width grows)
  const EXPAND = 0.85;        // finish expanding over the first 85% of the pin

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let raf = 0;
  function update() {
    raf = 0;
    if (window.innerWidth < 1024) { card.style.width = ''; return; }  // mobile: static, no expand
    const r = wrap.getBoundingClientRect();
    const total = wrap.offsetHeight - window.innerHeight;
    const prog = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    const e = clamp(prog / EXPAND, 0, 1);
    card.style.width = (W0 + (W1 - W0) * e).toFixed(2) + '%';
  }
  function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();

/* ═══════════════════════════════════════
   CLIENTS CAROUSEL — auto-rotates; drag/swipe or click a dot to take over.
   Autoplay pauses on hover/drag and while the tab is hidden.
═══════════════════════════════════════ */
(function initClientsCarousel() {
  const root = document.getElementById('clientsCarousel');
  if (!root) return;
  const slides = root.querySelectorAll('.clients-slide');
  const dots   = root.querySelectorAll('.clients-dot');
  if (!slides.length || !dots.length) return;

  let current = 0;

  function activate(idx) {
    if (idx < 0 || idx >= slides.length || idx === current) return;
    current = idx;
    slides.forEach((s, i) => s.classList.toggle('is-active', i === idx));
    dots.forEach((d, i)   => d.classList.toggle('is-active', i === idx));
  }
  function prev() { activate(current === 0 ? slides.length - 1 : current - 1); }
  function next() { activate((current + 1) % slides.length); }

  /* ── Autoplay ──────────────────────────────────────────────── */
  const AUTOPLAY_MS = 4500;
  let timer = null;
  let paused = false;   // true while hovered or dragging

  function tick() { activate((current + 1) % slides.length); }
  function startAutoplay() {
    if (timer || paused || document.hidden) return;
    timer = setInterval(tick, AUTOPLAY_MS);
  }
  function stopAutoplay() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  // Restart the countdown after any manual change so it doesn't jump instantly.
  function restartAutoplay() { stopAutoplay(); startAutoplay(); }

  dots.forEach((dot, i) => dot.addEventListener('click', () => {
    activate(i);
    restartAutoplay();
  }));

  // Pause while the pointer is over the carousel.
  root.addEventListener('mouseenter', () => { paused = true; stopAutoplay(); });
  root.addEventListener('mouseleave', () => { paused = false; startAutoplay(); });

  /* Pointer-driven drag/swipe. Threshold of 50px so accidental
     micro-drags don't trigger a slide change. Works for mouse,
     touch and pen via the unified pointer events. */
  const SWIPE_THRESHOLD = 50;
  let pointerDown = false;
  let startX = 0;
  let startY = 0;

  root.addEventListener('pointerdown', e => {
    pointerDown = true;
    startX = e.clientX;
    startY = e.clientY;
    paused = true;            // hold autoplay during the drag
    stopAutoplay();
  });
  root.addEventListener('pointerup', e => {
    if (!pointerDown) return;
    pointerDown = false;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    // Only act on mostly-horizontal drags
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next(); else prev();
    }
    paused = false;
    restartAutoplay();        // fresh countdown after the interaction
  });
  root.addEventListener('pointercancel', () => {
    pointerDown = false;
    paused = false;
    restartAutoplay();
  });
  // Prevent the browser from interpreting drag as image-drag/text-select
  root.addEventListener('dragstart', e => e.preventDefault());
  root.style.touchAction = 'pan-y';   // allow vertical page scroll, capture horizontal
  root.style.cursor = 'grab';

  // Don't rotate in a background tab; resume when it's visible again.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay(); else startAutoplay();
  });

  startAutoplay();
})();

/* ═══════════════════════════════════════
   FOOTER QUERY FORM
═══════════════════════════════════════ */
const form    = document.getElementById('queryForm');
const success = document.getElementById('querySuccess');

if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('.footer-submit');
    const orig = btn.innerHTML;
    btn.innerHTML = 'Sending…';
    btn.disabled  = true;

    setTimeout(() => {
      btn.innerHTML = orig;
      btn.disabled  = false;
      success.classList.remove('hidden');
      form.reset();
      setTimeout(() => success.classList.add('hidden'), 5000);
    }, 1300);
  });
}

/* ═══════════════════════════════════════
   ACTIVE NAV HIGHLIGHT
═══════════════════════════════════════ */
const navLinks   = document.querySelectorAll('.nav-link');
const sectionsIO = document.querySelectorAll('section[id]');

const secObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(l => {
        const href = l.getAttribute('href');
        const match = href === '#' + e.target.id;
        l.style.color = match ? '#F47721' : '';
      });
    }
  });
}, { threshold: 0.05 });

sectionsIO.forEach(s => secObs.observe(s));

/* ═══════════════════════════════════════
   PROJECTS OVERLAY, DATA + LOGIC
═══════════════════════════════════════ */
const PROJECTS_DATA = [

  // ════════════════════════════════
  //  INDUSTRIAL  (19 projects)
  // ════════════════════════════════
  { id:'bright-metal', category:'Industrial', name:'Bright Metal India Pvt. Ltd.', client:'Bright Metal India (P) Ltd.', location:'Sargoth, Reengus, Rajasthan', area:'1,50,000 sq.ft', year:'2022–23',
    img:'Projects%20Images/Industrial/Bright%20Metals%20India-20260606T092953Z-3-001/Bright%20Metals%20India/BMI%20Cover%20.JPG',
    desc:'Complete civil development of industrial sheds for production operations, administrative blocks, utility structures and site-wide infrastructure for a non-ferrous metal production facility at Sargoth, Reengus.' },

  { id:'hi-growth', category:'Industrial', name:'Hi-Growth International', client:'Hi-Growth International', location:'Kalwada, Mahindra SEZ', area:'Industrial Facility', year:'2024–25',
    img:'Projects%20Images/Industrial/HI%20Growth%20International-20260606T093013Z-3-001/HI%20Growth%20International/Hi%20Growth%20Cover.JPG',
    desc:'Cold storage and industrial facility construction with structural works for manufacturing and administrative areas within the Mahindra SEZ at Kalwada.' },

  { id:'universal-auto-iii', category:'Industrial', name:'Universal Autofoundry Unit-III', client:'Universal Autofoundry Ltd.', location:'Sargoth, Reengus, Rajasthan', area:'Industrial Facility', year:'2023–24',
    img:'Projects%20Images/Industrial/UAF%20___rd%20(SARGOTH)-20260606T093543Z-3-001/UAF%20_rd%20(SARGOTH)/UAF%20Industrial%203rd%20Cover.JPG',
    desc:'Complete civil construction of production sheds, utility structures and site infrastructure for auto component manufacturing at Sargoth, Reengus.' },

  { id:'paavan-products', category:'Industrial', name:'Paavan Products Bichoon Unit', client:'Paavan Products Pvt. Ltd.', location:'Bichoon, Rajasthan', area:'Industrial Shed', year:'2023–24',
    img:'Projects%20Images/Industrial/PAAVAN%20PRODUCTS%20BICHUN-20260606T093317Z-3-001/PAAVAN%20PRODUCTS%20BICHUN/PAAVAN%20Cover.JPG',
    desc:'Industrial shed for production and storage with administrative spaces and complete site development for manufacturing operations at Bichoon.' },

  { id:'precision-auto', category:'Industrial', name:'Precision Autocastings Unit II', client:'Precision Autocastings Pvt. Ltd.', location:'Kaladera, Chomu, Rajasthan', area:'2,00,000 sq.ft', year:'2023–24',
    img:'Projects%20Images/Industrial/Precision%20Autocastings%20Kaladera-20260606T093415Z-3-001/Precision%20Autocastings%20Kaladera/Precision%20Autocasting%20Website%20Cover.JPG',
    desc:'Complete civil development of large-scale production sheds for foundry operations, utility structures and site infrastructure spanning 2,00,000 sq.ft at Kaladera, Chomu.' },

  { id:'oswal-cables', category:'Industrial', name:'Oswal Cables Bagru Unit', client:'Oswal Cables', location:'Bagru Extension II, Jaipur', area:'Industrial Complex', year:'2019–20',
    img:'Projects%20Images/Industrial/Oswal%20Cables%20Bagru-20260606T093209Z-3-001/Oswal%20Cables%20Bagru/Oswal%20Cable%20Cover%20Website.png',
    desc:'Complete civil development of industrial sheds for cable manufacturing, office block and internal infrastructure at Bagru Extension II, Jaipur.' },

  { id:'universal-auto-ii', category:'Industrial', name:'Universal Autofoundry Unit-II', client:'Universal Autofoundry Ltd.', location:'SKS Industrial Area, Reengus', area:'Industrial Facility', year:'2018–19',
    img:'Projects%20Images/Industrial/UAF%20-%20__%20Reengus-20260606T093524Z-3-001/UAF%20-%20_%20Reengus/UAF%202nd%20Unit%20Website%20Cover.png',
    desc:'Full civil development with heavy-duty production sheds, administrative areas and comprehensive site infrastructure for auto component foundry operations at Reengus.' },

  { id:'arl-infratech', category:'Industrial', name:'ARL Infratech', client:'ARL Infratech Ltd.', location:'Bagru, Jaipur', area:'Manufacturing Facility', year:'2011–12',
    img:'Projects%20Images/Industrial/ARL%20Bagru-20260606T092855Z-3-001/ARL%20Bagru/ARL%20Cover.JPG',
    desc:'Cement sheet and pipe manufacturing facility with industrial sheds, utility blocks and site infrastructure for a building materials manufacturer at Bagru, Jaipur.' },

  { id:'sigma-j1', category:'Industrial', name:'Sigma Engineered Solutions J1 Unit', client:'Ultratech Metals (India) Pvt. Ltd.', location:'VKIA Industrial Area, Jaipur', area:'Factory Shed', year:'2005–06',
    img:'Projects%20Images/Industrial/Sigma%20Electricals%20VKIA-20260606T093508Z-3-001/Sigma%20Electricals%20VKIA/Sigma%20Cover.png',
    desc:'Factory shed construction for precision manufacturing with structural framework and complete utility infrastructure at VKIA Industrial Area, Jaipur.' },

  { id:'mayur-uniquoters-ind', category:'Industrial', name:'Mayur Uniquoters', client:'Mayur Uniquoters Ltd.', location:'Jaitpura, Jaipur', area:'Manufacturing Facility', year:'1993–94',
    img:'Projects%20Images/Industrial/Mayur%20Uniquoters%20Jaithpura-20260606T093051Z-3-001/Mayur%20Uniquoters%20Jaithpura/MU%20Cover.JPG',
    desc:'Manufacturing sheds and godowns for synthetic leather production facility at Jaitpura, one of SLM\'s long-standing industrial partnerships spanning three decades.' },

  { id:'ankit-roofing', category:'Industrial', name:'Ankit Roofing Unit', client:'ARL Infratech Ltd.', location:'Bagru, Jaipur', area:'Industrial Shed', year:'2005–06',
    img:'Projects%20Images/Industrial/Ankit%20Roofing%20Ltd.-20260606T092813Z-3-001/Ankit%20Roofing%20Ltd/AR%20Cover.png',
    desc:'Industrial shed for roofing materials manufacturing with site infrastructure, utility networks and administrative facilities at Bagru, Jaipur.' },

  { id:'vinayak-jewels', category:'Industrial', name:'Vinayak Jewels India', client:'Vinayak Jewels India Pvt. Ltd.', location:'Sitapura SEZ, Jaipur', area:'Production Facility', year:'2006–07',
    img:'Projects%20Images/Industrial/Vinayak%20Jewels-20260606T093630Z-3-001/Vinayak%20Jewels/Vinayak%20Jewels%20Cover.png',
    desc:'Production sheds for jewellery manufacturing within SEZ guidelines at Sitapura, built to comply with Special Economic Zone standards and export regulations.' },

  { id:'autolite', category:'Industrial', name:'Autolite India Ltd.', client:'Autolite India Ltd.', location:'Bindayaka, Rajasthan', area:'Factory Complex', year:'1994–97',
    img:'Projects%20Images/Industrial/Autolite%20-20260606T092916Z-3-001/Autolite/Autolite%20Cover.png',
    desc:'Factory shed and utility infrastructure for lighting equipment manufacturing at Bindayaka, one of SLM\'s key industrial projects from the 1990s.' },

  { id:'pacific-granites', category:'Industrial', name:'Pacific Granites', client:'Pacific Industries Ltd.', location:'RIICO Industrial Area, Sukher, Udaipur', area:'Processing Plant', year:'1990–91',
    img:'Projects%20Images/Industrial/Pacific%20Granite-20260606T093345Z-3-001/Pacific%20Granite/Pacific%20Granite%20Cover.png',
    desc:'Granite processing plant with specialised heavy-duty foundations for large machinery at RIICO Industrial Area, Sukher, Udaipur.' },

  { id:'reil-kanakpura', category:'Industrial', name:'REIL Kanakpura', client:'Rajasthan Electronics & Instruments Ltd.', location:'Kanakpura, Jaipur', area:'Electronics Facility', year:'1983–89',
    img:'Projects%20Images/Industrial/REIL%20Kanakpura-20260606T093429Z-3-001/REIL%20Kanakpura/REIL%20Cover.png',
    desc:'Electronics manufacturing sheds, utility structures and site infrastructure for REIL at Kanakpura, one of SLM\'s earliest large-scale industrial assignments, spanning six years from 1983 to 1989.' },

  { id:'microtek-sitapura', category:'Industrial', name:'Microtek International (Sitapura)', client:'Microtek International', location:'Sitapura, Jaipur', area:'Manufacturing Unit', year:',',
    img:'Projects%20Images/Industrial/Microtek%20-20260606T093116Z-3-001/Microtek/Microtek%20cover.png',
    desc:'Manufacturing and assembly facility for electronics products at Sitapura Industrial Area, featuring industrial sheds and complete support infrastructure.' },

  { id:'vaibhav-global', category:'Industrial', name:'Vaibhav Global Ltd.', client:'Vaibhav Global Ltd.', location:'Jaipur, Rajasthan', area:'Industrial Facility', year:',',
    img:'Projects%20Images/Industrial/Vaibhav%20%20Gems-20260606T093609Z-3-001/Vaibhav%20%20Gems/VGL%20Cover.png',
    desc:'Industrial facility for a leading global fashion jewellery and lifestyle products company, featuring production sheds, office infrastructure and complete site development at Jaipur.' },

  { id:'kec-ind', category:'Industrial', name:'KEC International Ltd.', client:'KEC International Ltd.', location:'Rajasthan', area:'Operations Facility', year:',',
    img:'Projects%20Images/Industrial/KEC%20Jhotwara-20260606T093026Z-3-001/KEC%20Jhotwara/KEC%20cover.png',
    desc:'Operations and infrastructure facility for KEC International, a global infrastructure EPC company, covering structural works, administrative blocks and complete site development.' },

  { id:'microtek-bassi', category:'Industrial', name:'Microtek International (Bassi)', client:'Microtek International', location:'Bassi, Jaipur', area:'Manufacturing Unit', year:',',
    img:'Projects%20Images/Industrial/Microtek%20-20260606T093116Z-3-001/Microtek/Microtek%20cover.png',
    desc:'Manufacturing facility for electronics products at Bassi, featuring industrial sheds, production spaces and complete utility infrastructure to support operations.' },

  // ════════════════════════════════
  //  HOSPITALITY  (9 projects)
  // ════════════════════════════════
  { id:'oberoi-vanyavilas', category:'Hospitality', name:'The Oberoi Vanyavilas Wildlife Resorts', client:'EIH Ltd.', location:'Ranthambore, Sawai Madhopur', area:'65,000 sq.ft', year:'2000–01',
    img:'Projects%20Images/Hospitality/Oberoi%20Vanyavillas-20260606T094412Z-3-001/Oberoi%20Vanyavillas/Oberoi%20Cover.png',
    desc:'An ultra-luxury 5-star wildlife resort developed across 20 acres, inspired by royal caravans. SLM executed tented accommodations with heritage detailing, spa, restaurant, wellness zones, staff quarters and complete internal roads and drainage infrastructure.' },

  { id:'stardom-resort', category:'Hospitality', name:'Stardom Resort', client:'SSG Kailash Hotels & Resorts', location:'Bhankrota, Jaipur', area:'50,000 sq.ft', year:'2019–20',
    img:'Projects%20Images/Hospitality/Stardom%20Resorts-20260606T094504Z-3-001/Stardom%20Resorts/Stardom%20Cover.png',
    desc:'Modern resort featuring 75 elegantly designed rooms, a bar, restaurant and related infrastructure. Works included luxury guest rooms, restaurant and bar block, utility infrastructure and internal road development at Bhankrota, Jaipur.' },

  { id:'hotel-allied-mahendra', category:'Hospitality', name:'Hotel Allied Mahendra', client:'Mahendra Group Jewellery & Gems', location:'Thikariya, Jaipur', area:'48,000 sq.ft', year:'2015–17',
    img:'Projects%20Images/Hospitality/Hotel%20Allied%20Mahindra-20260606T094348Z-3-001/Hotel%20Allied%20Mahindra/Allied%20cover.png',
    desc:'A 100-room business hotel with grand banquet hall and landscaped surroundings. SLM delivered the complete hotel block with banquet and conference hall, structural finishing, site landscaping and guest service infrastructure at Thikariya, Jaipur.' },

  { id:'westin-pushkar', category:'Hospitality', name:'The Westin Pushkar Resort & Spa', client:'Paradise Group', location:'Pushkar, Rajasthan', area:'Luxury Resort', year:'2014–16',
    img:'Projects%20Images/Hospitality/Westin%20Pushkar-20260606T094529Z-3-001/Westin%20Pushkar/Westin%20Cover.png',
    desc:'A 5-star wellness resort nestled in the Aravallis featuring 98 luxury guestrooms and villas with private plunge pools, a wellness spa and landscaped views. SLM delivered full infrastructure execution for the entire resort at Pushkar.' },

  { id:'hotel-paradise', category:'Hospitality', name:'Hotel Paradise (Ramada by Wyndham)', client:'Paradise Group', location:'Sikar Road, Jaipur', area:'80,000 sq.ft', year:'2007–08',
    img:'Projects%20Images/Hospitality/Ramada%20-20260606T094440Z-3-001/Ramada/Ramada.cover.JPG',
    desc:'A 9-storey premium hotel featuring 108 rooms and allied hospitality facilities. SLM built the multi-storey structure with modern façade, guest rooms, banquet and service areas with full structural and MEP integration.' },

  { id:'gold-palace', category:'Hospitality', name:'The Gold Palace and Resorts', client:'M/s Kishanpura Hotels Pvt. Ltd.', location:'Kukas, Jaipur', area:'86,000 sq.ft', year:'1999–2000',
    img:'Projects%20Images/Hospitality/Gold%20Palace%20Resort-20260606T094310Z-3-001/Gold%20Palace%20Resort/Gold%20Palace.Cover.png',
    desc:'A premium resort combining Mughal-era landscaping with Rajasthani architecture across 13 acres. Features 68 guest rooms with heritage façade, banquet halls, restaurants, spa facilities and recreational zones at Kukas, Jaipur.' },

  { id:'hotel-gajner', category:'Hospitality', name:'Hotel Gajner Palace', client:'HRH Group of Hotels', location:'Bikaner, Rajasthan', area:'Heritage Property', year:'1999–2000',
    img:'Projects%20Images/Hospitality/Gajner%20Palace%20Bikaner-20260606T094204Z-3-001/Gajner%20Palace%20Bikaner/Gajner%20Palace%20Cover.jpg',
    desc:'Heritage conservation and civil development within an iconic palace property in Bikaner, adding modern hospitality facilities while preserving its royal legacy, including spa, utility infrastructure and a kitchen block.' },

  { id:'hotel-gaudavan', category:'Hospitality', name:'Hotel Gaudavan', client:'Gaudavan Pvt. Ltd.', location:'Muhana, Sanganer, Jaipur', area:'Hotel Complex', year:'2004–05',
    img:'Projects%20Images/Hospitality/Gaudavan-20260606T094224Z-3-001/Gaudavan/Gaudavan%20cover.png',
    desc:'Turnkey development including full civil, electrical and plumbing works with landscaping and site infrastructure at Muhana, Sanganer, delivered as a complete ready-to-operate property.' },

  { id:'gorbandh-palace', category:'Hospitality', name:'Gorbandh Palace (Taj)', client:'HRH Group of Hotels', location:'Jaisalmer, Rajasthan', area:'Heritage Resort', year:',',
    img:'Projects%20Images/Hospitality/Gorbandh%20Jaisalmer-20260606T094327Z-3-001/Gorbandh%20Jaisalmer/Gorbandh%20cover.jpg',
    desc:'Royal-style heritage resort in Jaisalmer featuring heritage sandstone architecture, luxury guest rooms and dining areas, spa and recreational infrastructure with traditionally-detailed civil work befitting a Taj property.' },

  // ════════════════════════════════
  //  INSTITUTIONAL  (8 projects)
  // ════════════════════════════════
  { id:'hare-krishna', category:'Institutional', name:'Gupt Vrindavan Dham', client:'Hare Krishna Movement', location:'Hare Krishna Marg, Jagatpura, Jaipur', area:'2,00,000 sq.ft', year:',',
    img:'Projects%20Images/Institutional/Gupt%20Vrindavan%20Dham-20260606T095014Z-3-001/Gupt%20Vrindavan%20Dham/GVD%20Cover.png',
    desc:'Religious and cultural complex spanning 6 acres with a 17-storey temple, 25,000 sq.ft prayer hall with ornate gateway and exhibition spaces. SLM handled structural execution integrating conventional design with contemporary construction techniques.' },

  { id:'jecrc-ncr', category:'Institutional', name:'JECRC University (NCR Campus)', client:'JECRC University', location:'Matsya Industrial Area, Alwar', area:'1,00,000 sq.ft', year:',',
    img:'Projects%20Images/Institutional/JECRC%20University%20Alwar-20260606T095307Z-3-001/JECRC%20University%20Alwar/JECRC%20Cover.png',
    desc:'Retrofitting and renovation of existing structures for the northern region expansion campus at Alwar. Works encompassed structural reinforcement, exterior restoration and mechanical/electrical systems upgrades.' },

  { id:'digambar-jain', category:'Institutional', name:'Digambar Jain Shraman Sanskriti Sansthan', client:'Digambar Jain Shraman Sanskriti Sansthan', location:'Sanganer, Jaipur', area:'80,000 sq.ft', year:',',
    img:'Projects%20Images/Institutional/Digambar%20Jain%20Shraman%20Sanskriti%20Sansthan/Digambar%20Jain%20Shraman%20Sanskriti%20Sansthan/JS.Cover.png',
    desc:'G+4 spiritual retreat facility combining residential quarters and learning spaces for religious scholars and practitioners at Sanganer, Jaipur.' },

  { id:'vipra-foundation', category:'Institutional', name:'Vipra Foundation', client:'Vipra Foundation', location:'Mansarovar, Jaipur', area:'60,000 sq.ft', year:',',
    img:'Projects%20Images/Institutional/Vipra%20Foundation-20260606T095510Z-3-001/Vipra%20Foundation/VF%20Cover.jpg',
    desc:'Six-level research and educational hub emphasizing Vedic scholarship and skill advancement for community development, at Mansarovar, Jaipur.' },

  { id:'jnit-campus', category:'Institutional', name:'JNIT Campus', client:'Jagan Nath University', location:'Sitapura Industrial Area, Jaipur', area:'1,00,000 sq.ft', year:',',
    img:'Projects%20Images/Institutional/JNIT%20Sitapura-20260606T095403Z-3-001/JNIT%20Sitapura/JNIT%20Cover.png',
    desc:'Engineering institute development with classroom structures, student housing, administrative facilities and infrastructure networks at Sitapura Industrial Area, Jaipur.' },

  { id:'jagannath-chaksu', category:'Institutional', name:'Jagan Nath University (Chaksu)', client:'Jagan Institute of Management & Studies', location:'Chaksu, Tonk Road, Jaipur', area:'90,000 sq.ft', year:',',
    img:'Projects%20Images/Institutional/Jagan%20Nath%20University/Jagan%20Nath%20University/JIMS.coverJPG.jpg',
    desc:'Multi-building campus encompassing teaching facilities, residential quarters and utility infrastructure at Chaksu on Tonk Road, Jaipur.' },

  { id:'gyan-vihar', category:'Institutional', name:'Gyan Vihar University', client:'Gyan Vihar University', location:'Jagatpura, Jaipur', area:'1,00,000 sq.ft', year:',',
    img:'Projects%20Images/Institutional/Gyan%20Vihar-20260606T095049Z-3-001/Gyan%20Vihar/GV%20Cover.png',
    desc:'Twin 9-storey academic towers with administrative facilities designed for vertical space optimization at Jagatpura, Jaipur, serving thousands of students across engineering and management disciplines.' },

  { id:'jaipur-dental', category:'Institutional', name:'Jaipur Dental College', client:'Jaipur Dental College', location:'Kukas, Jaipur', area:'Educational Campus', year:',',
    img:'Projects%20Images/Institutional/Jaipur%20Dental%20College-20260606T095245Z-3-001/Jaipur%20Dental%20College/JDC%20cover.png',
    desc:'Medical institution development featuring lecture halls, clinical labs, student accommodation and professional-grade infrastructure at Kukas, Jaipur.' },

  // ════════════════════════════════
  //  COMMERCIAL  (3 projects)
  // ════════════════════════════════
  { id:'akshat-nilay-c', category:'Commercial', name:'Akshat Nilay', client:'Akshat Apartments Pvt. Ltd.', location:'Hawa Sadak, Civil Lines, Jaipur', area:'1,55,000 sq.ft', year:',',
    img:'Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN%20cover.png',
    desc:'Complete civil development of an 8-storey residential apartment complex featuring 62 premium units with structural precision, modern elevation and quality finishes at Civil Lines, Jaipur.' },

  { id:'akshat-meadows-c', category:'Commercial', name:'Akshat Meadows Township', client:'Akshat Apartments Pvt. Ltd.', location:'C-Scheme, Jaipur', area:'1,30,000 sq.ft', year:',',
    img:'Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM%20cover.png',
    desc:'Civil construction of a multi-storey residential apartment building comprising 36 luxury dwellings with reinforced concrete framework and high-end urban living standards at C-Scheme, Jaipur.' },

  { id:'akshat-meadows-2-c', category:'Commercial', name:'Akshat Meadows Township 2', client:'Akshat Apartments Pvt. Ltd.', location:'Sirsi Road, Jaipur', area:'3,19,000 sq.ft', year:',',
    img:'Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT%20Cover.png',
    desc:'Complete township combining luxury villas, group housing and lifestyle amenities across 9.81 acres, featuring 120 luxury villas, walk-up apartments, retail centre, tenement blocks and a 15,000 sq.ft clubhouse.' },

  // ════════════════════════════════
  //  RESIDENTIAL  (4 projects)
  // ════════════════════════════════
  { id:'akshat-nilay-r', category:'Residential', name:'Akshat Nilay', client:'Akshat Apartments Pvt. Ltd.', location:'Hawa Sadak, Civil Lines, Jaipur', area:'1,55,000 sq.ft', year:',',
    img:'Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN%20cover.png',
    desc:'Complete civil development of an 8-storey residential apartment complex featuring 62 premium units with structural precision, modern elevation and quality finishes at Civil Lines, Jaipur.' },

  { id:'akshat-meadows-r', category:'Residential', name:'Akshat Meadows Township', client:'Akshat Apartments Pvt. Ltd.', location:'C-Scheme, Jaipur', area:'1,30,000 sq.ft', year:',',
    img:'Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM%20cover.png',
    desc:'Civil construction of a multi-storey residential apartment building comprising 36 luxury dwellings with reinforced concrete framework and high-end urban living standards at C-Scheme, Jaipur.' },

  { id:'akshat-meadows-2-r', category:'Residential', name:'Akshat Meadows Township 2', client:'Akshat Apartments Pvt. Ltd.', location:'Sirsi Road, Jaipur', area:'3,19,000 sq.ft', year:',',
    img:'Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT%20Cover.png',
    desc:'Complete township combining luxury villas, group housing and lifestyle amenities across 9.81 acres, featuring 120 luxury villas, walk-up apartments, retail centre and a 15,000 sq.ft clubhouse with gym, library and theatre.' },

  // ════════════════════════════════
  //  PUBLIC WORKS  (4 projects)
  // ════════════════════════════════
  { id:'hindustan-zinc-pw', category:'Public Works', name:'Hindustan Zinc Limited', client:'Hindustan Zinc Ltd.', location:'Udaipur, Rajasthan', area:'Multiple Facilities', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/10/901ca8f25a3367819559f74f5eab3470febb91ff.png',
    desc:'Multiple landmark developments for one of India\'s largest zinc-lead-silver producers, including the 5-storey Yashad Bhavan corporate office at Swaroop Sagar, residential quarters, guesthouses and hospitals at various mine sites (Zawar, Dariba, Agucha).' },

  { id:'birla-corporation', category:'Public Works', name:'Birla Corporation', client:'Birla Corporation Ltd.', location:'Chittorgarh, Rajasthan', area:'Corporate Complex', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/09/ec11123b6e300372bcd9506f2601ccba5345a2e0-1024x683.jpg',
    desc:'Comprehensive civil works featuring 8 premium residential flats for senior officers, administrative office building and renovation of guest house facilities at Chittorgarh for a leading cement manufacturer.' },

  { id:'maharana-pratap', category:'Public Works', name:'Maharana Pratap Memorial', client:'Mewar Dynasty – Late Shri Arvind Singh Mewar', location:'Udaipur, Rajasthan', area:'Heritage Monument', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/09/189281ddec2add2ed87294a19342a1139ffd66b3-683x1024.jpg',
    desc:'Heritage monument construction combining traditional stone craftsmanship with modern structural standards, honouring the warrior king\'s legacy with architectural precision befitting the historic site at Udaipur.' },

  { id:'rajasthan-police', category:'Public Works', name:'Rajasthan Police Academy (Hostel)', client:'Public Works Dept., Govt. of Rajasthan', location:'Jaipur, Rajasthan', area:'Hostel Complex', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/09/Screenshot-2025-09-16-150329.png',
    desc:'Hostel facility for police trainees at the Rajasthan Police Academy, featuring modern amenities, secure design and complete civil works delivered for the Public Works Department, Government of Rajasthan.' },
];

/* ═══════════════════════════════════════
   PROJECT DETAILS, gallery + scope per id
═══════════════════════════════════════ */
const PROJECT_DETAILS = {
  // ── INDUSTRIAL ──
  'bright-metal': { gallery:['Projects%20Images/Industrial/Bright%20Metals%20India-20260606T092953Z-3-001/Bright%20Metals%20India/BMI%20Cover%20.JPG','Projects%20Images/Industrial/Bright%20Metals%20India-20260606T092953Z-3-001/Bright%20Metals%20India/BMI%20Gallery.1.JPG','Projects%20Images/Industrial/Bright%20Metals%20India-20260606T092953Z-3-001/Bright%20Metals%20India/BMI%20Gallery.2.JPG','Projects%20Images/Industrial/Bright%20Metals%20India-20260606T092953Z-3-001/Bright%20Metals%20India/BMI%20Gallery.3.JPG'],
    scope:['Industrial sheds for production operations','Utility structures & site infrastructure','Administrative blocks for smoother workflows','Planned circulation, internal roads & drainage'] },
  'hi-growth': { gallery:['Projects%20Images/Industrial/HI%20Growth%20International-20260606T093013Z-3-001/HI%20Growth%20International/Hi%20Growth%20Cover.JPG','Projects%20Images/Industrial/HI%20Growth%20International-20260606T093013Z-3-001/HI%20Growth%20International/Hi%20Growth%20Gallery.2.png','Projects%20Images/Industrial/HI%20Growth%20International-20260606T093013Z-3-001/HI%20Growth%20International/Hi%20Growth%20gallery.1.png'],
    scope:['Industrial & storage sheds for cold storage operations','Administrative and service areas','Utility structures & mechanical provisions','Integrated internal road and drainage systems'] },
  'universal-auto-iii': { gallery:['Projects%20Images/Industrial/UAF%20___rd%20(SARGOTH)-20260606T093543Z-3-001/UAF%20_rd%20(SARGOTH)/UAF%20Industrial%203rd%20Cover.JPG','Projects%20Images/Industrial/UAF%20___rd%20(SARGOTH)-20260606T093543Z-3-001/UAF%20_rd%20(SARGOTH)/UAF%203rd%20Gallery.2.JPG','Projects%20Images/Industrial/UAF%20___rd%20(SARGOTH)-20260606T093543Z-3-001/UAF%20_rd%20(SARGOTH)/UAF%20Industrial%20Gallery.1.JPG'],
    scope:['Industrial sheds with high-capacity production layout','Utility & service structures','Administrative and control rooms','Site infrastructure and internal circulation planning'] },
  'paavan-products': { gallery:['Projects%20Images/Industrial/PAAVAN%20PRODUCTS%20BICHUN-20260606T093317Z-3-001/PAAVAN%20PRODUCTS%20BICHUN/PAAVAN%20Cover.JPG','Projects%20Images/Industrial/PAAVAN%20PRODUCTS%20BICHUN-20260606T093317Z-3-001/PAAVAN%20PRODUCTS%20BICHUN/PAAVAN%20Galery.1.JPG','Projects%20Images/Industrial/PAAVAN%20PRODUCTS%20BICHUN-20260606T093317Z-3-001/PAAVAN%20PRODUCTS%20BICHUN/PAAVAN%20Gallery.2.JPG','Projects%20Images/Industrial/PAAVAN%20PRODUCTS%20BICHUN-20260606T093317Z-3-001/PAAVAN%20PRODUCTS%20BICHUN/PAAVAN%20Gallery.3.JPG','Projects%20Images/Industrial/PAAVAN%20PRODUCTS%20BICHUN-20260606T093317Z-3-001/PAAVAN%20PRODUCTS%20BICHUN/PAAVAN%20Gallery.4.JPG'],
    scope:['Industrial shed for production & storage','Administrative and support areas','Internal road network & site development','Utility structures for smooth operations'] },
  'precision-auto': { gallery:['Projects%20Images/Industrial/Precision%20Autocastings%20Kaladera-20260606T093415Z-3-001/Precision%20Autocastings%20Kaladera/Precision%20Autocasting%20Website%20Cover.JPG','Projects%20Images/Industrial/Precision%20Autocastings%20Kaladera-20260606T093415Z-3-001/Precision%20Autocastings%20Kaladera/PAC%20Gallery.1.JPG','Projects%20Images/Industrial/Precision%20Autocastings%20Kaladera-20260606T093415Z-3-001/Precision%20Autocastings%20Kaladera/PAC%20Gallery.2.JPG','Projects%20Images/Industrial/Precision%20Autocastings%20Kaladera-20260606T093415Z-3-001/Precision%20Autocastings%20Kaladera/PAC%20Gallery.3.JPG'],
    scope:['Large-scale production sheds for foundry operations','Administrative and support blocks','Utility structures with integrated services','Site-wide infrastructure and internal circulation roads'] },
  'oswal-cables': { gallery:['Projects%20Images/Industrial/Oswal%20Cables%20Bagru-20260606T093209Z-3-001/Oswal%20Cables%20Bagru/Oswal%20Cable%20Cover%20Website.png','Projects%20Images/Industrial/Oswal%20Cables%20Bagru-20260606T093209Z-3-001/Oswal%20Cables%20Bagru/OC%20Gallery.1.JPG','Projects%20Images/Industrial/Oswal%20Cables%20Bagru-20260606T093209Z-3-001/Oswal%20Cables%20Bagru/OC%20Gallery.2.png','Projects%20Images/Industrial/Oswal%20Cables%20Bagru-20260606T093209Z-3-001/Oswal%20Cables%20Bagru/OC%20Gallery.3.png'],
    scope:['Industrial sheds for cable & conductor production','Dedicated administrative office block','Utility & electrical service structures','Internal roads and drainage systems'] },
  'universal-auto-ii': { gallery:['Projects%20Images/Industrial/UAF%20-%20__%20Reengus-20260606T093524Z-3-001/UAF%20-%20_%20Reengus/UAF%202nd%20Unit%20Website%20Cover.png','Projects%20Images/Industrial/UAF%20-%20__%20Reengus-20260606T093524Z-3-001/UAF%20-%20_%20Reengus/UAF%202nd%20Gallery.1.JPG','Projects%20Images/Industrial/UAF%20-%20__%20Reengus-20260606T093524Z-3-001/UAF%20-%20_%20Reengus/UAF%202nd%20Gallery.2.png','Projects%20Images/Industrial/UAF%20-%20__%20Reengus-20260606T093524Z-3-001/UAF%20-%20_%20Reengus/UAF%202nd%20Gallery.3.png'],
    scope:['Heavy-duty industrial sheds','Administrative & operations block','Site infrastructure & internal circulation roads','Utility and drainage development'] },
  'arl-infratech': { gallery:['Projects%20Images/Industrial/ARL%20Bagru-20260606T092855Z-3-001/ARL%20Bagru/ARL%20Cover.JPG','Projects%20Images/Industrial/ARL%20Bagru-20260606T092855Z-3-001/ARL%20Bagru/ARL%20Gallery.1%20.JPG','Projects%20Images/Industrial/ARL%20Bagru-20260606T092855Z-3-001/ARL%20Bagru/ARL%20Gallery.2.JPG','Projects%20Images/Industrial/ARL%20Bagru-20260606T092855Z-3-001/ARL%20Bagru/ARL%20Gallery.3.JPG'],
    scope:['Industrial sheds for cement product lines','Utility blocks & site infrastructure','Efficient layout for process flow','Civil & structural execution'] },
  'sigma-j1': { gallery:['Projects%20Images/Industrial/Sigma%20Electricals%20VKIA-20260606T093508Z-3-001/Sigma%20Electricals%20VKIA/Sigma%20Cover.png','Projects%20Images/Industrial/Sigma%20Electricals%20VKIA-20260606T093508Z-3-001/Sigma%20Electricals%20VKIA/Sigma%20Gallery.1.png','Projects%20Images/Industrial/Sigma%20Electricals%20VKIA-20260606T093508Z-3-001/Sigma%20Electricals%20VKIA/Sigma%20Gallery.2.png','Projects%20Images/Industrial/Sigma%20Electricals%20VKIA-20260606T093508Z-3-001/Sigma%20Electricals%20VKIA/Sigma%20Gallery.3.png'],
    scope:['Factory shed for precision manufacturing','Site infrastructure & utilities','Structural & civil framework','Optimized layout for operations'] },
  'mayur-uniquoters-ind': { gallery:['Projects%20Images/Industrial/Mayur%20Uniquoters%20Jaithpura-20260606T093051Z-3-001/Mayur%20Uniquoters%20Jaithpura/MU%20Cover.JPG','Projects%20Images/Industrial/Mayur%20Uniquoters%20Jaithpura-20260606T093051Z-3-001/Mayur%20Uniquoters%20Jaithpura/MU%20Gallery.1.png','Projects%20Images/Industrial/Mayur%20Uniquoters%20Jaithpura-20260606T093051Z-3-001/Mayur%20Uniquoters%20Jaithpura/MU%20Gallery.2.JPG','Projects%20Images/Industrial/Mayur%20Uniquoters%20Jaithpura-20260606T093051Z-3-001/Mayur%20Uniquoters%20Jaithpura/MU%20Gallery.3.png'],
    scope:['Manufacturing sheds & godowns','Utility structures for operations','Internal roads & site development','Durable civil execution'] },
  'ankit-roofing': { gallery:['Projects%20Images/Industrial/Ankit%20Roofing%20Ltd.-20260606T092813Z-3-001/Ankit%20Roofing%20Ltd/AR%20Cover.png','Projects%20Images/Industrial/Ankit%20Roofing%20Ltd.-20260606T092813Z-3-001/Ankit%20Roofing%20Ltd/AR%20gallery.1.png','Projects%20Images/Industrial/Ankit%20Roofing%20Ltd.-20260606T092813Z-3-001/Ankit%20Roofing%20Ltd/AR%20gallery.2.png','Projects%20Images/Industrial/Ankit%20Roofing%20Ltd.-20260606T092813Z-3-001/Ankit%20Roofing%20Ltd/AR%20gallery.3.png','Projects%20Images/Industrial/Ankit%20Roofing%20Ltd.-20260606T092813Z-3-001/Ankit%20Roofing%20Ltd/AR%20gallery.4.png'],
    scope:['Industrial shed for roofing manufacturing','Site infrastructure & utilities','Administrative provisions','Civil and structural works'] },
  'vinayak-jewels': { gallery:['Projects%20Images/Industrial/Vinayak%20Jewels-20260606T093630Z-3-001/Vinayak%20Jewels/Vinayak%20Jewels%20Cover.png','Projects%20Images/Industrial/Vinayak%20Jewels-20260606T093630Z-3-001/Vinayak%20Jewels/Vinayak%20Jewels%20Gallery.1.jpg','Projects%20Images/Industrial/Vinayak%20Jewels-20260606T093630Z-3-001/Vinayak%20Jewels/Vinayak%20Jewels%20Gallery.3.jpg','Projects%20Images/Industrial/Vinayak%20Jewels-20260606T093630Z-3-001/Vinayak%20Jewels/Vinayak%20jewels%20gallery.2.jpg'],
    scope:['Production sheds for jewellery manufacturing','Utility and service structures','Civil works within SEZ guidelines','Complete site development'] },
  'autolite': { gallery:['Projects%20Images/Industrial/Autolite%20-20260606T092916Z-3-001/Autolite/Autolite%20Cover.png','Projects%20Images/Industrial/Autolite%20-20260606T092916Z-3-001/Autolite/Autolite%20Gallery%20.1.png','Projects%20Images/Industrial/Autolite%20-20260606T092916Z-3-001/Autolite/Autolite%20Gallery.2.png'], scope:['Factory shed for light component production','Utility & service blocks','Civil and electrical integration','Site-level development'] },
  'pacific-granites': { gallery:['Projects%20Images/Industrial/Pacific%20Granite-20260606T093345Z-3-001/Pacific%20Granite/Pacific%20Granite%20Cover.png','Projects%20Images/Industrial/Pacific%20Granite-20260606T093345Z-3-001/Pacific%20Granite/Pacific%20Granite%20Gallery.1.png'],
    scope:['Granite processing sheds','Specialized heavy foundations','Industrial layout & site development','Structural works for machinery load'] },
  'reil-kanakpura': { gallery:['Projects%20Images/Industrial/REIL%20Kanakpura-20260606T093429Z-3-001/REIL%20Kanakpura/REIL%20Cover.png','Projects%20Images/Industrial/REIL%20Kanakpura-20260606T093429Z-3-001/REIL%20Kanakpura/REIL%20Gallery.1.png','Projects%20Images/Industrial/REIL%20Kanakpura-20260606T093429Z-3-001/REIL%20Kanakpura/REIL%20Gallery.2.png','Projects%20Images/Industrial/REIL%20Kanakpura-20260606T093429Z-3-001/REIL%20Kanakpura/REIL%20Gallery.3.png'],
    scope:['Electronics manufacturing sheds','Utility & service structures','Civil works & site infrastructure','Integrated process layout'] },
  'microtek-sitapura': { gallery:['Projects%20Images/Industrial/Microtek%20-20260606T093116Z-3-001/Microtek/Microtek%20cover.png'], scope:['Manufacturing and assembly facility','Industrial sheds with complete support','Utility networks and services','Administrative infrastructure'] },
  'vaibhav-global': { gallery:['Projects%20Images/Industrial/Vaibhav%20%20Gems-20260606T093609Z-3-001/Vaibhav%20%20Gems/VGL%20Cover.png','Projects%20Images/Industrial/Vaibhav%20%20Gems-20260606T093609Z-3-001/Vaibhav%20%20Gems/VGL%20Gallery.1.png','Projects%20Images/Industrial/Vaibhav%20%20Gems-20260606T093609Z-3-001/Vaibhav%20%20Gems/VGL%20Gallery.2.jpg'], scope:['Industrial facility for fashion jewellery production','Production sheds & office infrastructure','Complete site development','Utility & service infrastructure'] },
  'kec-ind': { gallery:['Projects%20Images/Industrial/KEC%20Jhotwara-20260606T093026Z-3-001/KEC%20Jhotwara/KEC%20cover.png','Projects%20Images/Industrial/KEC%20Jhotwara-20260606T093026Z-3-001/KEC%20Jhotwara/Kec%20Gallery.1.png','Projects%20Images/Industrial/KEC%20Jhotwara-20260606T093026Z-3-001/KEC%20Jhotwara/Kec%20gallery.2.png'], scope:['Operations and infrastructure facility','Structural works & administrative blocks','Complete site development','Service infrastructure'] },
  'microtek-bassi': { gallery:['Projects%20Images/Industrial/Microtek%20-20260606T093116Z-3-001/Microtek/Microtek%20cover.png'], scope:['Manufacturing and assembly operations','Industrial sheds with full support','Electrical & utility networks','Site development and infrastructure'] },

  // ── HOSPITALITY ──
  'oberoi-vanyavilas': { gallery:['Projects%20Images/Hospitality/Oberoi%20Vanyavillas-20260606T094412Z-3-001/Oberoi%20Vanyavillas/Oberoi%20Cover.png','Projects%20Images/Hospitality/Oberoi%20Vanyavillas-20260606T094412Z-3-001/Oberoi%20Vanyavillas/Oberoi%20Gallery.1.png','Projects%20Images/Hospitality/Oberoi%20Vanyavillas-20260606T094412Z-3-001/Oberoi%20Vanyavillas/Oberoi%20Gallery.10.png','Projects%20Images/Hospitality/Oberoi%20Vanyavillas-20260606T094412Z-3-001/Oberoi%20Vanyavillas/Oberoi%20Gallery.6.png','Projects%20Images/Hospitality/Oberoi%20Vanyavillas-20260606T094412Z-3-001/Oberoi%20Vanyavillas/Oberoi%20Gallery.7.png','Projects%20Images/Hospitality/Oberoi%20Vanyavillas-20260606T094412Z-3-001/Oberoi%20Vanyavillas/Oberoi%20Gallery.8.png','Projects%20Images/Hospitality/Oberoi%20Vanyavillas-20260606T094412Z-3-001/Oberoi%20Vanyavillas/Oberoi%20Gallery.9.png','Projects%20Images/Hospitality/Oberoi%20Vanyavillas-20260606T094412Z-3-001/Oberoi%20Vanyavillas/Oberoi%20gallery.3.jpg'], scope:['Luxury tented accommodations with heritage detailing','Spa, restaurant, and wellness zones amid landscaped greens','Staff quarters & back-of-house facilities','Internal roads, utilities, and drainage infrastructure'] },
  'stardom-resort': { gallery:['Projects%20Images/Hospitality/Stardom%20Resorts-20260606T094504Z-3-001/Stardom%20Resorts/Stardom%20Cover.png','Projects%20Images/Hospitality/Stardom%20Resorts-20260606T094504Z-3-001/Stardom%20Resorts/Stardom%20Gallery.1.JPG','Projects%20Images/Hospitality/Stardom%20Resorts-20260606T094504Z-3-001/Stardom%20Resorts/Stardom%20Gallery.2.jpg','Projects%20Images/Hospitality/Stardom%20Resorts-20260606T094504Z-3-001/Stardom%20Resorts/Stardom%20Gallery.3.JPG','Projects%20Images/Hospitality/Stardom%20Resorts-20260606T094504Z-3-001/Stardom%20Resorts/Stardom%20Gallery.4.jpg','Projects%20Images/Hospitality/Stardom%20Resorts-20260606T094504Z-3-001/Stardom%20Resorts/Stardom%20Gallery.5.JPG'],
    scope:['Luxury guest rooms & hospitality facilities','Restaurant & bar block','Utility and service infrastructure','Internal road & site development'] },
  'hotel-allied-mahendra': { gallery:['Projects%20Images/Hospitality/Hotel%20Allied%20Mahindra-20260606T094348Z-3-001/Hotel%20Allied%20Mahindra/Allied%20cover.png','Projects%20Images/Hospitality/Hotel%20Allied%20Mahindra-20260606T094348Z-3-001/Hotel%20Allied%20Mahindra/Allied%20gallery.1.png','Projects%20Images/Hospitality/Hotel%20Allied%20Mahindra-20260606T094348Z-3-001/Hotel%20Allied%20Mahindra/Allied%20gallery.2.png'], scope:['Hotel block with banquet & conference hall','Structural & finishing works','Site landscaping & utilities','Guest service infrastructure'] },
  'westin-pushkar': { gallery:['Projects%20Images/Hospitality/Westin%20Pushkar-20260606T094529Z-3-001/Westin%20Pushkar/Westin%20Cover.png','Projects%20Images/Hospitality/Westin%20Pushkar-20260606T094529Z-3-001/Westin%20Pushkar/Westin%20gallery.1.JPG','Projects%20Images/Hospitality/Westin%20Pushkar-20260606T094529Z-3-001/Westin%20Pushkar/Westin%20gallery.2.JPG','Projects%20Images/Hospitality/Westin%20Pushkar-20260606T094529Z-3-001/Westin%20Pushkar/Westin%20gallery.3.JPG','Projects%20Images/Hospitality/Westin%20Pushkar-20260606T094529Z-3-001/Westin%20Pushkar/Westin%20gallery.4.JPG','Projects%20Images/Hospitality/Westin%20Pushkar-20260606T094529Z-3-001/Westin%20Pushkar/Westin%20gallery.5.JPG'],
    scope:['98 luxury guestrooms and villas','Private plunge pools with landscaped views','Wellness spa and leisure amenities','Civil and infrastructure execution across site'] },
  'hotel-paradise': { gallery:['Projects%20Images/Hospitality/Ramada%20-20260606T094440Z-3-001/Ramada/Ramada.cover.JPG','Projects%20Images/Hospitality/Ramada%20-20260606T094440Z-3-001/Ramada/Ramada%20.1.png','Projects%20Images/Hospitality/Ramada%20-20260606T094440Z-3-001/Ramada/Ramada.2.JPG','Projects%20Images/Hospitality/Ramada%20-20260606T094440Z-3-001/Ramada/Ramada.3.JPG'],
    scope:['Multi-storey hotel structure with modern façade','Guest rooms, banquet & service areas','Structural and MEP integration','Civil finishing & infrastructure delivery'] },
  'gold-palace': { gallery:['Projects%20Images/Hospitality/Gold%20Palace%20Resort-20260606T094310Z-3-001/Gold%20Palace%20Resort/Gold%20Palace.Cover.png','Projects%20Images/Hospitality/Gold%20Palace%20Resort-20260606T094310Z-3-001/Gold%20Palace%20Resort/Gold%20Palace.1.png','Projects%20Images/Hospitality/Gold%20Palace%20Resort-20260606T094310Z-3-001/Gold%20Palace%20Resort/Gold%20Palace.2.png','Projects%20Images/Hospitality/Gold%20Palace%20Resort-20260606T094310Z-3-001/Gold%20Palace%20Resort/Gold%20Palace.3.png','Projects%20Images/Hospitality/Gold%20Palace%20Resort-20260606T094310Z-3-001/Gold%20Palace%20Resort/Gold%20Palace.4.png','Projects%20Images/Hospitality/Gold%20Palace%20Resort-20260606T094310Z-3-001/Gold%20Palace%20Resort/Gold%20Palace.5.png'],
    scope:['68 guest rooms with heritage façade detailing','Banquet halls, restaurants, and spa facilities','Recreational zones and landscaped courtyards','Infrastructure development across 13 acres'] },
  'hotel-gajner': { gallery:['Projects%20Images/Hospitality/Gajner%20Palace%20Bikaner-20260606T094204Z-3-001/Gajner%20Palace%20Bikaner/Gajner%20Palace%20Cover.jpg','Projects%20Images/Hospitality/Gajner%20Palace%20Bikaner-20260606T094204Z-3-001/Gajner%20Palace%20Bikaner/Gajner%20gallery.1.jpg','Projects%20Images/Hospitality/Gajner%20Palace%20Bikaner-20260606T094204Z-3-001/Gajner%20Palace%20Bikaner/Gajner%20gallery.3.jpg','Projects%20Images/Hospitality/Gajner%20Palace%20Bikaner-20260606T094204Z-3-001/Gajner%20Palace%20Bikaner/Gajner%20gallery.4.jpg'], scope:['Spa & wellness facility within heritage complex','Utility infrastructure & service areas','Kitchen block and maintenance works','Restoration aligned with conservation standards'] },
  'hotel-gaudavan': { gallery:['Projects%20Images/Hospitality/Gaudavan-20260606T094224Z-3-001/Gaudavan/Gaudavan%20cover.png','Projects%20Images/Hospitality/Gaudavan-20260606T094224Z-3-001/Gaudavan/Gaudavan.2.png','Projects%20Images/Hospitality/Gaudavan-20260606T094224Z-3-001/Gaudavan/Gaudavan.4.png','Projects%20Images/Hospitality/Gaudavan-20260606T094224Z-3-001/Gaudavan/Gaudavan.5.png','Projects%20Images/Hospitality/Gaudavan-20260606T094224Z-3-001/Gaudavan/gaudavan.3.png'],
    scope:['Complete civil & finishing works','Electrical & plumbing installations','Landscape & external development','Ready-to-operate handover'] },
  'gorbandh-palace': { gallery:['Projects%20Images/Hospitality/Gorbandh%20Jaisalmer-20260606T094327Z-3-001/Gorbandh%20Jaisalmer/Gorbandh%20cover.jpg','Projects%20Images/Hospitality/Gorbandh%20Jaisalmer-20260606T094327Z-3-001/Gorbandh%20Jaisalmer/Gorbandh%20.2.webp','Projects%20Images/Hospitality/Gorbandh%20Jaisalmer-20260606T094327Z-3-001/Gorbandh%20Jaisalmer/Gorbandh.3.webp','Projects%20Images/Hospitality/Gorbandh%20Jaisalmer-20260606T094327Z-3-001/Gorbandh%20Jaisalmer/Gorbandh.4.jpg'], scope:['Heritage-style architecture in sandstone','Luxury guest rooms and dining areas','Spa and recreational infrastructure','Civil works matching traditional detailing'] },

  // ── INSTITUTIONAL ──
  'hare-krishna': { gallery:['Projects%20Images/Institutional/Gupt%20Vrindavan%20Dham-20260606T095014Z-3-001/Gupt%20Vrindavan%20Dham/GVD%20Cover.png','Projects%20Images/Institutional/Gupt%20Vrindavan%20Dham-20260606T095014Z-3-001/Gupt%20Vrindavan%20Dham/GVD.1.png','Projects%20Images/Institutional/Gupt%20Vrindavan%20Dham-20260606T095014Z-3-001/Gupt%20Vrindavan%20Dham/GVD.2.png','Projects%20Images/Institutional/Gupt%20Vrindavan%20Dham-20260606T095014Z-3-001/Gupt%20Vrindavan%20Dham/GVD.3.png','Projects%20Images/Institutional/Gupt%20Vrindavan%20Dham-20260606T095014Z-3-001/Gupt%20Vrindavan%20Dham/GVD.4.JPG','Projects%20Images/Institutional/Gupt%20Vrindavan%20Dham-20260606T095014Z-3-001/Gupt%20Vrindavan%20Dham/GVD.5.jpeg','Projects%20Images/Institutional/Gupt%20Vrindavan%20Dham-20260606T095014Z-3-001/Gupt%20Vrindavan%20Dham/GVD.6.png'],
    scope:['17-storey temple & cultural center','25,000 sq.ft temple hall with grand Mayur Dwar','Convention & exhibition areas','Complete civil and infrastructure works'] },
  'jecrc-ncr': { gallery:['Projects%20Images/Institutional/JECRC%20University%20Alwar-20260606T095307Z-3-001/JECRC%20University%20Alwar/JECRC%20Cover.png','Projects%20Images/Institutional/JECRC%20University%20Alwar-20260606T095307Z-3-001/JECRC%20University%20Alwar/JECRC.1.png','Projects%20Images/Institutional/JECRC%20University%20Alwar-20260606T095307Z-3-001/JECRC%20University%20Alwar/JECRC.2.png','Projects%20Images/Institutional/JECRC%20University%20Alwar-20260606T095307Z-3-001/JECRC%20University%20Alwar/JECRC.3.jpeg','Projects%20Images/Institutional/JECRC%20University%20Alwar-20260606T095307Z-3-001/JECRC%20University%20Alwar/JECRC.4.png'],
    scope:['Structural repair & façade restoration','Civil & interior refurbishing works','Plumbing & electrical upgrades','Comprehensive campus redevelopment'] },
  'digambar-jain': { gallery:['Projects%20Images/Institutional/Digambar%20Jain%20Shraman%20Sanskriti%20Sansthan/Digambar%20Jain%20Shraman%20Sanskriti%20Sansthan/JS.Cover.png','Projects%20Images/Institutional/Digambar%20Jain%20Shraman%20Sanskriti%20Sansthan/Digambar%20Jain%20Shraman%20Sanskriti%20Sansthan/JS%201.JPG','Projects%20Images/Institutional/Digambar%20Jain%20Shraman%20Sanskriti%20Sansthan/Digambar%20Jain%20Shraman%20Sanskriti%20Sansthan/JS.2.png','Projects%20Images/Institutional/Digambar%20Jain%20Shraman%20Sanskriti%20Sansthan/Digambar%20Jain%20Shraman%20Sanskriti%20Sansthan/JS.3.png'],
    scope:['G+4 institutional & hostel buildings','Civil & interior development','Spiritual and residential facilities','Structural and finishing works'] },
  'vipra-foundation': { gallery:['Projects%20Images/Institutional/Vipra%20Foundation-20260606T095510Z-3-001/Vipra%20Foundation/VF%20Cover.jpg','Projects%20Images/Institutional/Vipra%20Foundation-20260606T095510Z-3-001/Vipra%20Foundation/VF.1.png','Projects%20Images/Institutional/Vipra%20Foundation-20260606T095510Z-3-001/Vipra%20Foundation/VF.2.png','Projects%20Images/Institutional/Vipra%20Foundation-20260606T095510Z-3-001/Vipra%20Foundation/VF.3.png','Projects%20Images/Institutional/Vipra%20Foundation-20260606T095510Z-3-001/Vipra%20Foundation/VF.4.png'],
    scope:['Six-floor institutional complex','Classrooms & training centers','Research and skill development facilities','Structural & civil execution'] },
  'jnit-campus': { gallery:['Projects%20Images/Institutional/JNIT%20Sitapura-20260606T095403Z-3-001/JNIT%20Sitapura/JNIT%20Cover.png','Projects%20Images/Institutional/JNIT%20Sitapura-20260606T095403Z-3-001/JNIT%20Sitapura/JNIT.1.png','Projects%20Images/Institutional/JNIT%20Sitapura-20260606T095403Z-3-001/JNIT%20Sitapura/JNIT.3.png','Projects%20Images/Institutional/JNIT%20Sitapura-20260606T095403Z-3-001/JNIT%20Sitapura/JNIT.4.png','Projects%20Images/Institutional/JNIT%20Sitapura-20260606T095403Z-3-001/JNIT%20Sitapura/JNIT.5.png','Projects%20Images/Institutional/JNIT%20Sitapura-20260606T095403Z-3-001/JNIT%20Sitapura/JNIT.6.png','Projects%20Images/Institutional/JNIT%20Sitapura-20260606T095403Z-3-001/JNIT%20Sitapura/JNIT.7.png'],
    scope:['Academic & administrative blocks','Hostel & residential facilities','Internal roads and site infrastructure','Complete campus development'] },
  'jagannath-chaksu': { gallery:['Projects%20Images/Institutional/Jagan%20Nath%20University/Jagan%20Nath%20University/JIMS.coverJPG.jpg','Projects%20Images/Institutional/Jagan%20Nath%20University/Jagan%20Nath%20University/JIMS.1.JPG','Projects%20Images/Institutional/Jagan%20Nath%20University/Jagan%20Nath%20University/JIMS.3.JPG','Projects%20Images/Institutional/Jagan%20Nath%20University/Jagan%20Nath%20University/JIMS.4.JPG','Projects%20Images/Institutional/Jagan%20Nath%20University/Jagan%20Nath%20University/JIMS.5.JPG','Projects%20Images/Institutional/Jagan%20Nath%20University/Jagan%20Nath%20University/JIMS.6.JPG'],
    scope:['Academic and residential buildings','Infrastructure & utility networks','Administrative facilities','Complete campus planning & delivery'] },
  'gyan-vihar': { gallery:['Projects%20Images/Institutional/Gyan%20Vihar-20260606T095049Z-3-001/Gyan%20Vihar/GV%20Cover.png','Projects%20Images/Institutional/Gyan%20Vihar-20260606T095049Z-3-001/Gyan%20Vihar/GV.1.png','Projects%20Images/Institutional/Gyan%20Vihar-20260606T095049Z-3-001/Gyan%20Vihar/GV.2.png','Projects%20Images/Institutional/Gyan%20Vihar-20260606T095049Z-3-001/Gyan%20Vihar/GV.3.png'],
    scope:['Twin 9-storey academic towers','Administrative & service blocks','Structural & civil works','Site infrastructure execution'] },
  'jaipur-dental': { gallery:['Projects%20Images/Institutional/Jaipur%20Dental%20College-20260606T095245Z-3-001/Jaipur%20Dental%20College/JDC%20cover.png','Projects%20Images/Institutional/Jaipur%20Dental%20College-20260606T095245Z-3-001/Jaipur%20Dental%20College/JDC%20.1.png'], scope:['Auditorium & classroom blocks','Hostel and student facilities','Civil & infrastructure works','Institutional-level finishing'] },

  // ── COMMERCIAL ──
  'akshat-nilay-c': { gallery:['Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN%20cover.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.1.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.2.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.3.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.4.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.5.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.6.png'],
    scope:['8-storey premium apartment building','62 well-planned residential units','Structural precision and modern elevation','Civil & infrastructure execution with quality assurance'] },
  'akshat-meadows-c': { gallery:['Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM%20cover.png','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.1.jpg','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.2.png','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.3.png','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.4.png','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.5.JPG','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.6.png','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.7.JPG'],
    scope:['Multi-storey premium residential structure','36 exclusive apartments','Reinforced concrete framework with modern finishes','Executed to high-end urban living standards'] },
  'akshat-meadows-2-c': { gallery:['Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT%20Cover.png','Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT.1.png','Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT.2.png','Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT.3.png','Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT.4.png'],
    scope:['120 luxury villas & walk-up apartments','Retail center & tenement blocks','15,000 sq.ft clubhouse with gym, library & home theatre','Infrastructure including roads, STP, and electrical networks'] },

  // ── RESIDENTIAL ──
  'akshat-nilay-r': { gallery:['Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN%20cover.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.1.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.2.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.3.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.4.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.5.png','Projects%20Images/Residential/Akshat%20Nilay-20260606T101144Z-3-001/Akshat%20Nilay/AN.6.png'],
    scope:['8-storey premium apartment building','62 well-planned residential units','Structural precision and modern elevation','Civil & infrastructure execution with quality assurance'] },
  'akshat-meadows-r': { gallery:['Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM%20cover.png','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.1.jpg','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.2.png','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.3.png','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.4.png','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.5.JPG','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.6.png','Projects%20Images/Residential/Akshat%20Meadows-20260606T101125Z-3-001/Akshat%20Meadows/AM.7.JPG'],
    scope:['Multi-storey premium residential structure','36 exclusive apartments','Reinforced concrete framework with modern finishes','Executed to high-end urban living standards'] },
  'akshat-meadows-2-r': { gallery:['Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT%20Cover.png','Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT.1.png','Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT.2.png','Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT.3.png','Projects%20Images/Residential/Akshay%20Trishla-20260606T101204Z-3-001/Akshay%20Trishla/AT.4.png'],
    scope:['120 luxury villas & walk-up apartments','Retail center & tenement blocks','15,000 sq.ft clubhouse with gym, library & home theatre','Infrastructure including roads, STP, and electrical networks'] },

  // ── PUBLIC WORKS ──
  'hindustan-zinc-pw': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/edcf4554df9ea0c5aeeb8f89d57d54f3470ce6cd-1-1024x683.jpg'],
    scope:['5-storey Yashad Bhavan corporate office at Swaroop Sagar','Residential quarters and guesthouse at Zinc Park & Agucha Mines','Hospitals at Zawar and Dariba Mines','Civil, structural & finishing works with large-scale excavation'] },
  'birla-corporation': { gallery:[],
    scope:['8 premium residential flats for senior officers','Administrative office building','Renovation & upgradation of Birla Guest House','Interior and finishing works for new blocks'] },
  'maharana-pratap': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/189281ddec2add2ed87294a19342a1139ffd66b3-1-1024x683.jpg','https://slmindia.in/wp-content/uploads/2025/12/Component-94.png'],
    scope:['Monumental heritage construction','Traditional stone craftsmanship','Structural integrity with cultural preservation','Landmark tribute to Mewar\'s royal history'] },
  'rajasthan-police': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/Screenshot-2025-09-16-150329-1024x683.jpg'],
    scope:['Hostel building for police trainees','Modern amenities and service infrastructure','Secure design with durable civil execution','Delivered under Government of Rajasthan (PWD) works'] },
};

/* ═══════════════════════════════════════
   SEO helpers — update meta tags at runtime
═══════════════════════════════════════ */
function setSEO({ title, description, url, image }) {
  if (title) {
    document.title = title;
    const ot = document.getElementById('ogTitle'); if (ot) ot.setAttribute('content', title);
    const tt = document.getElementById('twTitle'); if (tt) tt.setAttribute('content', title);
  }
  if (description) {
    const md = document.getElementById('metaDesc'); if (md) md.setAttribute('content', description);
    const od = document.getElementById('ogDesc');   if (od) od.setAttribute('content', description);
    const td = document.getElementById('twDesc');   if (td) td.setAttribute('content', description);
  }
  if (url) {
    const cl = document.getElementById('canonicalLink'); if (cl) cl.setAttribute('href', url);
    const ou = document.getElementById('ogUrl');         if (ou) ou.setAttribute('content', url);
  }
  if (image) {
    const oi = document.getElementById('ogImage'); if (oi) oi.setAttribute('content', image);
    const ti = document.getElementById('twImage'); if (ti) ti.setAttribute('content', image);
  }
}

/* Inject/replace a JSON-LD structured-data block by id */
function setJSONLD(id, data) {
  let s = document.getElementById(id);
  if (!s) {
    s = document.createElement('script');
    s.id = id;
    s.type = 'application/ld+json';
    document.head.appendChild(s);
  }
  s.textContent = JSON.stringify(data);
}

/* ═══════════════════════════════════════
   PROJECTS LIST PAGE (projects.html)
═══════════════════════════════════════ */
function renderProjectsPage(category) {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  const catSpan  = document.getElementById('overlayCategory');
  const catTitle = document.getElementById('overlayCategoryTitle');
  const countEl  = document.getElementById('overlayCount');

  const filtered = PROJECTS_DATA.filter(p => p.category === category);
  if (catSpan)  catSpan.textContent  = category;
  if (catTitle) catTitle.textContent = category + ' Projects';
  if (countEl)  countEl.textContent  = filtered.length + ' Project' + (filtered.length !== 1 ? 's' : '');

  // ── SEO: dynamic meta per category
  const pageUrl = location.origin + location.pathname + '?category=' + encodeURIComponent(category);
  const hero = filtered[0] ? filtered[0].img : undefined;
  setSEO({
    title: category + ' Construction Projects | SLM',
    description: 'SLM has delivered ' + filtered.length + ' landmark ' + category + ' projects across India since 1954. Explore the full portfolio of ' + category.toLowerCase() + ' construction work.',
    url: pageUrl,
    image: hero
  });
  setJSONLD('catListingLD', {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': category + ' Projects | SLM Construction',
    'url': pageUrl,
    'description': 'SLM ' + category + ' construction portfolio',
    'isPartOf': { '@type': 'WebSite', 'name': 'SLM Construction', 'url': location.origin + '/' },
    'breadcrumb': {
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home',     'item': location.origin + '/' },
        { '@type': 'ListItem', 'position': 2, 'name': 'Projects', 'item': location.origin + '/projects.html' },
        { '@type': 'ListItem', 'position': 3, 'name': category,   'item': pageUrl }
      ]
    },
    'mainEntity': {
      '@type': 'ItemList',
      'numberOfItems': filtered.length,
      'itemListElement': filtered.map((p, i) => ({
        '@type': 'ListItem',
        'position': i + 1,
        'url': location.origin + '/project.html?id=' + p.id,
        'name': p.name
      }))
    }
  });

  grid.innerHTML = filtered.map(p => `
    <a href="project.html?id=${p.id}" class="proj-thumb-card" style="text-decoration:none;color:inherit;display:block">
      <div style="overflow:hidden;aspect-ratio:16/10">
        <img src="${p.img}" alt="${p.name}" class="proj-thumb-img" loading="lazy" data-parallax-pos="0.12" />
      </div>
      <div style="padding:20px;background:#fff">
        <p style="font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#F47721;margin-bottom:6px">${p.category}</p>
        <h3 style="font-family:'Archivo Black',sans-serif;font-size:16px;font-weight:600;color:#1F211F;line-height:1.35;margin-bottom:5px">${p.name}</h3>
        <p style="color:#6B7280;font-size:13px;margin-bottom:5px">${p.location}</p>
        <p style="color:#1F211F;font-size:12px;font-weight:600">${p.area}</p>
      </div>
    </a>
  `).join('');
}

/* ═══════════════════════════════════════
   PROJECT DETAIL PAGE (project.html)
═══════════════════════════════════════ */
function renderProjectPage(id) {
  const p = PROJECTS_DATA.find(proj => proj.id === id);
  const content = document.getElementById('projectDetailContent');
  if (!content) return;
  if (!p) {
    content.innerHTML = `<div style="padding:140px 24px;text-align:center"><h1 style="font-family:'Archivo Black',sans-serif;font-size:42px;font-weight:700;margin:0 0 16px">Project Not Found</h1><p style="color:#6B7280;margin-bottom:28px">The project you're looking for doesn't exist.</p><a href="projects.html" style="display:inline-flex;align-items:center;gap:8px;background:#F47721;color:#fff;padding:14px 28px;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">Back to Projects</a></div>`;
    return;
  }
  const details = PROJECT_DETAILS[id] || { gallery: [], scope: [] };

  // ── SEO: dynamic meta per project
  const pageUrl = location.origin + location.pathname + '?id=' + p.id;
  const seoDesc = (p.desc || '').slice(0, 160).replace(/\s+\S*$/, '') + '…';
  setSEO({
    title: p.name + ' | ' + p.category + ' Project | SLM Construction',
    description: seoDesc,
    url: pageUrl,
    image: p.img
  });
  setJSONLD('projectLD', {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    'name': p.name,
    'description': p.desc,
    'url': pageUrl,
    'image': p.img,
    'dateCreated': p.year,
    'locationCreated': { '@type': 'Place', 'address': p.location },
    'author': { '@type': 'Organization', 'name': 'M/S Sohan Lal Mathur', 'url': location.origin + '/' },
    'about': p.category,
    'isPartOf': { '@type': 'WebSite', 'name': 'SLM Construction', 'url': location.origin + '/' }
  });
  setJSONLD('projectBreadcrumbLD', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home',     'item': location.origin + '/' },
      { '@type': 'ListItem', 'position': 2, 'name': p.category, 'item': location.origin + '/projects.html?category=' + encodeURIComponent(p.category) },
      { '@type': 'ListItem', 'position': 3, 'name': p.name,     'item': pageUrl }
    ]
  });
  const allImgs = [...new Set([p.img, ...(details.gallery || [])])].filter(Boolean);
  const scope = details.scope || [];

  // Related projects — ONLY other projects in the same category (wraps forward from current).
  const catProjects = PROJECTS_DATA.filter(x => x.category === p.category);
  const curIdx = catProjects.findIndex(x => x.id === id);
  const related = [];
  for (let i = 1; i <= catProjects.length - 1; i++) {
    const r = catProjects[(curIdx + i) % catProjects.length];
    if (r.id !== id) related.push(r);
  }

  // Lead sentence for hero
  const leadSentence = (p.desc || '').split(/\.\s+/)[0].replace(/\.+$/, '') + '.';

  // Icons for scope cards (cycles through 5 line-icons)
  const scopeIcons = [
    '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 12h.01M9 15h.01M13 9h.01M13 12h.01M13 15h.01"/>',          // building
    '<path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M6.93 6.93L4.1 4.1m12.97 12.97l-2.83-2.83M6.93 17.07L4.1 19.9"/><circle cx="12" cy="12" r="4"/>',  // compass
    '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>',  // layers
    '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',  // wrench
    '<path d="M9 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2h-4"/><path d="M9 22V7a5 5 0 0110 0v4"/>'   // utility
  ];

  content.innerHTML = `
    <!-- Hero -->
    <section class="prj-hero">
      <div class="prj-hero-img" style="background-image:url('${p.img}')" role="img" aria-label="${p.name}" data-parallax-pos="0.16"></div>
      <img class="prj-hero-photo" src="${p.img}" alt="${p.name}" loading="eager" />
      <div class="prj-hero-content">
        <p class="prj-hero-eyebrow">
          <span>${p.category}</span>
          <span class="prj-dot"></span>
          <span>${p.location}</span>
        </p>
        <h1 class="prj-hero-title">${p.name}</h1>
        <p class="prj-hero-lead">${leadSentence}</p>
      </div>
    </section>

    <!-- Body: key facts sidebar + main content -->
    <div class="prj-body-wrap">

      <!-- Key facts — sticky sidebar on desktop, 2×2 card on mobile -->
      <aside class="prj-facts" aria-label="Project key facts">
        <div class="prj-facts-grid">
          <div class="prj-fact"><span class="prj-fact-lbl">Client</span><span class="prj-fact-val">${p.client}</span></div>
          <div class="prj-fact"><span class="prj-fact-lbl">Location</span><span class="prj-fact-val">${p.location}</span></div>
          <div class="prj-fact"><span class="prj-fact-lbl">Year</span><span class="prj-fact-val">${p.year || '—'}</span></div>
          <div class="prj-fact"><span class="prj-fact-lbl">Built-Up Area</span><span class="prj-fact-val">${p.area}</span></div>
        </div>
      </aside>

      <main class="prj-main">

        <!-- Overview -->
        <section class="prj-overview">
          <h2 class="prj-h2">Project Overview</h2>
          <p>${p.desc}</p>
        </section>

        ${scope.length ? `
        <!-- Scope of Work: carousel on mobile / 4-card grid on desktop -->
        <section class="prj-scope">
          <h2 class="prj-h2">Scope of Work</h2>
          <div class="prj-scope-track" id="prjScopeTrack">
            ${scope.map((s, i) => `
              <article class="prj-scope-card">
                <div class="prj-scope-icon">
                  <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">${scopeIcons[i % scopeIcons.length]}</svg>
                </div>
                <h3 class="prj-scope-title">${s.split(/[,(]/)[0].trim()}</h3>
                <p class="prj-scope-desc">${s}</p>
              </article>
            `).join('')}
          </div>
          <div class="prj-scope-dots" id="prjScopeDots">
            ${scope.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}
          </div>
        </section>
        ` : ''}

        ${allImgs.length ? `
        <!-- Gallery -->
        <section class="prj-gallery">
          <div class="prj-gallery-head">
            <h2 class="prj-h2">Gallery</h2>
            <p class="prj-gallery-count">${allImgs.length} Image${allImgs.length !== 1 ? 's' : ''}</p>
          </div>
          <figure class="prj-gallery-lead">
            <img src="${allImgs[0]}" data-lb-idx="0" loading="eager" alt="${p.name} — primary image" />
          </figure>
          ${allImgs.length > 1 ? `
            <div class="prj-gallery-grid">
              ${allImgs.slice(1).map((src, i) => `
                <img src="${src}" data-lb-idx="${i + 1}" loading="lazy" alt="${p.name} — image ${i + 2}" />
              `).join('')}
            </div>
          ` : ''}
        </section>
        ` : ''}

      </main>
    </div>

    <!-- Related projects carousel -->
    <section class="prj-rel" aria-label="More projects">
      <div class="prj-rel-head">
        <p class="prj-rel-eyebrow"><span class="prj-rel-bar"></span>More Projects</p>
        <h2 class="prj-rel-title">Other work from<br/><span class="prj-rel-title-cat">${p.category}</span>.</h2>
      </div>
      <div class="prj-rel-viewport">
        <button type="button" class="prj-rel-btn prj-rel-btn--prev" data-dir="-1" aria-label="Previous projects">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div class="prj-rel-track" id="prjRelTrack">
          ${related.map(r => `
            <a href="project.html?id=${r.id}" class="prj-rel-card">
              <figure class="prj-rel-media">
                <img src="${r.img}" alt="${r.name}" loading="lazy" />
                <span class="prj-rel-tag">${r.category}</span>
              </figure>
              <div class="prj-rel-body">
                <h3 class="prj-rel-name">${r.name}</h3>
                <p class="prj-rel-loc">${r.location || ''}</p>
                <span class="prj-rel-arrow" aria-hidden="true">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </div>
            </a>
          `).join('')}
        </div>
        <button type="button" class="prj-rel-btn prj-rel-btn--next" data-dir="1" aria-label="Next projects">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </div>
    </section>


    <!-- Sticky bottom action bar (mobile only via CSS) -->
    <div class="prj-sticky-bar" id="prjStickyBar" aria-hidden="false">
      <a href="tel:+919509911871" class="prj-sticky-call" aria-label="Call SLM">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498A1 1 0 0121 17v3a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
      </a>
      <a href="index.html#contact" class="prj-sticky-enquire">
        Enquire About This Project
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
    </div>
  `;

  // Wire up behaviours
  document.body.classList.add('has-prj-sticky-bar');
  _initPrjGallery(allImgs);
  _initPrjScopeCarousel();
  _initPrjStickyBar();
  _initPrjRelatedCarousel();
}

function _initPrjRelatedCarousel() {
  const track = document.getElementById('prjRelTrack');
  if (!track) return;
  document.querySelectorAll('.prj-rel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = parseInt(btn.dataset.dir, 10) || 1;
      const card = track.firstElementChild;
      if (!card) return;
      const step = card.getBoundingClientRect().width + 16;   // card + gap
      track.scrollBy({ left: dir * step, behavior: 'smooth' });
    });
  });
}

/* ═══════════════════════════════════════
   PROJECT DETAIL — interactive helpers
═══════════════════════════════════════ */
function _initPrjGallery(imgs) {
  document.querySelectorAll('.prj-gallery [data-lb-idx]').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      const idx = parseInt(img.dataset.lbIdx, 10) || 0;
      openLightbox(imgs, idx);
    });
  });
}

/* Services mobile carousel — updates progress dots as user swipes */
function _initServicesCarousel() {
  const track = document.querySelector('.sv-track');
  const dotsWrap = document.querySelector('.sv-dots');
  if (!track || !dotsWrap) return;
  const dots = dotsWrap.querySelectorAll('span');
  if (!dots.length) return;
  track.addEventListener('scroll', () => {
    const card = track.firstElementChild;
    if (!card) return;
    const w = card.getBoundingClientRect().width + 16; // card + gap
    const idx = Math.round(track.scrollLeft / w);
    dots.forEach((d, i) => d.classList.toggle('active', i === Math.min(dots.length - 1, Math.max(0, idx))));
  }, { passive: true });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initServicesCarousel);
} else {
  _initServicesCarousel();
}

function _initPrjScopeCarousel() {
  const track = document.getElementById('prjScopeTrack');
  const dotsWrap = document.getElementById('prjScopeDots');
  if (!track || !dotsWrap) return;
  const dots = dotsWrap.querySelectorAll('span');
  if (!dots.length) return;
  track.addEventListener('scroll', () => {
    const card = track.firstElementChild;
    if (!card) return;
    const w = card.getBoundingClientRect().width + 16; // + gap
    const idx = Math.round(track.scrollLeft / w);
    dots.forEach((d, i) => d.classList.toggle('active', i === Math.min(dots.length - 1, idx)));
  }, { passive: true });
}

function _initPrjStickyBar() {
  const bar = document.getElementById('prjStickyBar');
  if (!bar) return;
  let ticking = false;
  function update() {
    ticking = false;
    // Hide when user is near the header (< 200px from top)
    if (window.scrollY < 200) bar.classList.add('is-hidden');
    else bar.classList.remove('is-hidden');
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}


/* ═══════════════════════════════════════
   LIGHTBOX, gallery zoom
═══════════════════════════════════════ */
let LB_IMGS = [];
let LB_IDX  = 0;
let LB_SAVED_SCROLL = 0;

function openLightbox(imgs, idx) {
  LB_IMGS = Array.isArray(imgs) ? imgs : [imgs];
  LB_IDX  = idx || 0;
  const lb = document.getElementById('galleryLightbox');
  if (!lb) return;
  document.getElementById('lightboxImg').src = LB_IMGS[LB_IDX];
  updateLightboxCounter();
  // Lock body scroll so taps inside the lightbox never shift the page behind
  LB_SAVED_SCROLL = window.scrollY || window.pageYOffset;
  document.body.style.top = '-' + LB_SAVED_SCROLL + 'px';
  document.body.classList.add('lb-open');
  lb.classList.add('open');
}

function closeLightbox() {
  const lb = document.getElementById('galleryLightbox');
  if (lb) lb.classList.remove('open');
  // Restore scroll
  document.body.classList.remove('lb-open');
  document.body.style.top = '';
  if (LB_SAVED_SCROLL) window.scrollTo(0, LB_SAVED_SCROLL);
}

function lightboxNav(dir) {
  if (!LB_IMGS.length) return;
  LB_IDX = (LB_IDX + dir + LB_IMGS.length) % LB_IMGS.length;
  document.getElementById('lightboxImg').src = LB_IMGS[LB_IDX];
  updateLightboxCounter();
}

function updateLightboxCounter() {
  const c = document.getElementById('lightboxCounter');
  if (c) c.textContent = `${LB_IDX + 1} / ${LB_IMGS.length}`;
}

document.addEventListener('keydown', e => {
  const lb = document.getElementById('galleryLightbox');
  if (lb && lb.classList.contains('open')) {
    if (e.key === 'Escape')      closeLightbox();
    else if (e.key === 'ArrowRight') lightboxNav(1);
    else if (e.key === 'ArrowLeft')  lightboxNav(-1);
  }
});

/* Lightbox touch-swipe (mobile): left → next, right → previous */
(function lightboxSwipe() {
  const lb = document.getElementById('galleryLightbox');
  if (!lb) return;
  let startX = 0, startY = 0, moved = false;
  const THRESH = 40;
  lb.addEventListener('touchstart', e => {
    if (!lb.classList.contains('open')) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    moved = false;
  }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (!lb.classList.contains('open') || moved) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    // Horizontal swipe dominant (ignore vertical scrolls)
    if (Math.abs(dx) > THRESH && Math.abs(dx) > Math.abs(dy)) {
      lightboxNav(dx < 0 ? 1 : -1);
      moved = true;
    }
  }, { passive: true });
})();


/* ── Journey page scroll-driven animations (runs on journey.html) ── */
/* Journey hero — crossfade through 4 decade-tinted images, update decade tag */
function _initJourneyHeroReel() {
  const stack = document.getElementById('jnHeroSlides');
  const tag   = document.getElementById('jnHeroDecade');
  if (!stack) return;
  const slides = stack.querySelectorAll('.jn-hero-img');
  if (slides.length < 2) return;

  const INTERVAL = 5000;
  let idx = 0;

  function advance() {
    const next = (idx + 1) % slides.length;
    slides[idx].classList.remove('is-active');
    slides[next].classList.add('is-active');
    if (tag) {
      tag.classList.add('is-changing');
      setTimeout(() => {
        tag.textContent = slides[next].dataset.era || '';
        tag.classList.remove('is-changing');
      }, 140);
    }
    idx = next;
  }

  let timer = setInterval(advance, INTERVAL);
  document.addEventListener('visibilitychange', () => {
    clearInterval(timer);
    if (!document.hidden) timer = setInterval(advance, INTERVAL);
  });
}

/* Journey hero — clickable timeline ticks that scroll to their milestone card */
function _initJourneyHeroTicks() {
  const ticks = document.querySelectorAll('.jn-tick[data-target]');
  if (!ticks.length) return;
  const cards = document.querySelectorAll('.jn-m');
  if (!cards.length) return;

  ticks.forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.target, 10);
      const target = cards[Math.max(0, Math.min(cards.length - 1, i))];
      if (!target) return;
      const navH = window.innerWidth >= 1024 ? 96 : 72;
      if (window.__lenis && typeof window.__lenis.scrollTo === 'function') {
        window.__lenis.scrollTo(target, { offset: -navH, duration: 1.4 });
      } else {
        const y = target.getBoundingClientRect().top + window.scrollY - navH;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });
}

function initJourneyAnimations() {
  /* Hero: decade image reel + clickable timeline ticks */
  _initJourneyHeroReel();
  _initJourneyHeroTicks();

  const timeline = document.getElementById('jnTimeline');
  if (!timeline) return;

  const cardsCol     = document.querySelector('.jn-cards');
  const items        = document.querySelectorAll('.jn-m');
  const navItems     = document.querySelectorAll('.jn-nav-item');
  const counters     = document.querySelectorAll('.jn-counter');
  const railFill     = document.getElementById('jnRailFill');
  const trackFill    = document.getElementById('jnTrackFill');
  const countNum     = document.getElementById('jnCountNum');
  const countTotal   = document.getElementById('jnCountTotal');
  const activeTitle  = document.getElementById('jnActiveTitle');
  const activeYear   = document.getElementById('jnActiveYear');

  const total = items.length;
  if (countTotal) countTotal.textContent = String(total).padStart(2, '0');

  let currentActive = -1;
  let ticking = false;

  function setActiveMilestone(idx) {
    if (idx === currentActive || idx < 0 || idx >= total) return;
    currentActive = idx;
    const it = items[idx];
    const title = it.dataset.title || '';
    const year  = it.dataset.year  || '';

    // Update sidebar count with flip animation
    if (countNum) {
      const newNum = String(idx + 1).padStart(2, '0');
      if (countNum.textContent !== newNum) {
        countNum.classList.remove('flip');
        // force reflow so the animation can replay
        void countNum.offsetWidth;
        countNum.textContent = newNum;
        countNum.classList.add('flip');
      }
    }

    // Update title with flip animation
    if (activeTitle && activeTitle.textContent !== title) {
      activeTitle.classList.remove('flip');
      void activeTitle.offsetWidth;
      activeTitle.textContent = title;
      activeTitle.classList.add('flip');
    }
    if (activeYear && activeYear.textContent !== year) {
      activeYear.textContent = year;
    }

    // Rail fill, proportional to position in sequence
    if (railFill) {
      const pct = ((idx + 1) / total) * 100;
      railFill.style.width = pct + '%';
    }

    // Active states on nav items + cards
    navItems.forEach((n, i) => n.classList.toggle('active', i === idx));
    items.forEach((m, i) => m.classList.toggle('is-active', i === idx));
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const vh = window.innerHeight;
      const anchorY = vh * 0.42; // preferred "active" viewport line

      // ── Main vertical rail fill (cards-column progress)
      if (trackFill && cardsCol) {
        const colRect = cardsCol.getBoundingClientRect();
        const progressPx = anchorY - colRect.top;
        const pct = Math.max(0, Math.min(100, (progressPx / colRect.height) * 100));
        trackFill.style.height = pct + '%';
      }

      // ── Find the milestone whose marker line is closest to viewport center
      let bestIdx  = 0;
      let bestDist = Infinity;
      items.forEach((it, i) => {
        const strip = it.querySelector('.jn-m-strip') || it;
        const r = strip.getBoundingClientRect();
        const markerY = r.top + r.height / 2;
        const dist = Math.abs(markerY - anchorY);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      });
      setActiveMilestone(bestIdx);
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  requestAnimationFrame(onScroll);

  // ── Reveal milestones with IntersectionObserver
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
  items.forEach(it => {
    if (!it.classList.contains('in-view')) revealObs.observe(it);
  });

  // ── Counters
  const runCounter = el => {
    if (el.dataset.done === '1') return;
    el.dataset.done = '1';
    const target   = parseInt(el.dataset.target, 10);
    const suffix   = el.dataset.suffix || '';
    const duration = 1500;
    const start    = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  };
  const countObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        runCounter(e.target);
        countObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => countObs.observe(c));

  // Jump-nav click → smooth scroll
  navItems.forEach((n, i) => {
    n.addEventListener('click', e => {
      e.preventDefault();
      const target = items[i];
      if (!target) return;
      const y = target.getBoundingClientRect().top + window.pageYOffset - 110;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });
}

/* ── Leader card 3D tilt on mouse move (runs on about.html) ── */
function initLeadershipTilt() {
  const cards = document.querySelectorAll('.ld-card[data-tilt]');
  cards.forEach(card => {
    if (card.dataset.tiltBound === '1') return;
    card.dataset.tiltBound = '1';

    let rafId = null;
    let tx = 0, ty = 0, cx = 0, cy = 0;

    function apply() {
      cx += (tx - cx) * 0.15;
      cy += (ty - cy) * 0.15;
      const portrait = card.querySelector('.ld-card-portrait img');
      card.style.transform = `perspective(900px) rotateX(${cy}deg) rotateY(${cx}deg) translateY(-6px)`;
      if (portrait) {
        portrait.style.transform = `scale(1.05) translate(${-cx * 0.6}px, ${-cy * 0.6}px)`;
      }
      if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) {
        rafId = requestAnimationFrame(apply);
      } else { rafId = null; }
    }

    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top)  / r.height;
      tx = (px - 0.5) * 7;           // max 3.5° rotation on Y axis
      ty = -(py - 0.5) * 5;          // max 2.5° on X axis
      if (!rafId) rafId = requestAnimationFrame(apply);
    });

    card.addEventListener('mouseleave', () => {
      tx = 0; ty = 0;
      if (!rafId) rafId = requestAnimationFrame(apply);
      // Smooth return then clear inline transform so hover/active states work
      setTimeout(() => {
        card.style.transform = '';
        const portrait = card.querySelector('.ld-card-portrait img');
        if (portrait) portrait.style.transform = '';
      }, 400);
    });
  });
}

/* ═══════════════════════════════════════
   PAGE ROUTER — runs the right init on each separate page
═══════════════════════════════════════ */
/* ═══════════════════════════════════════
   TOOLS & MACHINERY (tools.html)
═══════════════════════════════════════ */
const TM_CATEGORIES = [
  { id:'concrete',    label:'Concrete Works',         icon:'<path d="M3 21h18M5 21V8l7-5 7 5v13M9 11h.01M9 14h.01M9 17h.01M15 11h.01M15 14h.01M15 17h.01"/>' },
  { id:'earthworks',  label:'Earthworks & Compaction',icon:'<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>' },
  { id:'cutting',     label:'Cutting, Drilling & Finishing', icon:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>' },
  { id:'material',    label:'Material Handling',      icon:'<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>' },
  { id:'fabrication', label:'Fabrication & Welding',  icon:'<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>' },
  { id:'qa',          label:'Surveying & QA Lab',     icon:'<path d="M9 3h6a1 1 0 011 1v2h2a1 1 0 011 1v12a2 2 0 01-2 2H7a2 2 0 01-2-2V7a1 1 0 011-1h2V4a1 1 0 011-1z"/><path d="M9 11h6M9 15h4"/>' }
];

// SLM WordPress upload host for equipment imagery
const TM_IMG_BASE = 'https://slmindia.in/wp-content/uploads/2025/12/';

const TM_EQUIPMENT = [
  // Concrete Works (3 types · 27 units)
  { cat:'concrete',   name:'Concrete Mixers',            count:'14', unit:'Units',   img:TM_IMG_BASE+'6569e43676f6f01d50f372780e1731607e4f6f4f.jpg', desc:'On-site batch mixers for continuous concrete supply across active sites.' },
  { cat:'concrete',   name:'Self-Loading Mixer',         count:'1',  unit:'Unit',    img:TM_IMG_BASE+'9b3359a950e123125ec9093ae9338e7283b22286.jpg', desc:'All-in-one mobile mixer that loads, mixes, and pours without external support.' },
  { cat:'concrete',   name:'Concrete Vibrators',         count:'12', unit:'Units',   img:TM_IMG_BASE+'2665f9ca4078126cf3f4592fd177091f14486aa5.jpg', desc:'Needle and plate vibrators that eliminate air pockets from freshly poured concrete.' },

  // Earthworks & Compaction
  { cat:'earthworks', name:'Earth Compactors',           count:'4',  unit:'Units',   img:TM_IMG_BASE+'037e080e3585b4bd1d8f00e869b51ce4fd0a2418.jpg', desc:'Vibratory soil compactors for base preparation and trench backfilling.' },
  { cat:'earthworks', name:'Tractor Bull Loader',        count:'1',  unit:'Unit',    img:TM_IMG_BASE+'eda85fde5489caecbd7de7b7cf6a4a05aff421e3.jpg', desc:'Tractor-mounted front loader for site clearance, material handling, and grading.' },
  { cat:'earthworks', name:'Shuttering Material',        count:'1L+',unit:'Sq.Ft',   img:TM_IMG_BASE+'a7b9a5f7a4d439ad23f230ff2d0d113fb8560582.jpg', desc:'Steel plates, props, marine plywood, and jacks — ready to deploy across multiple sites simultaneously.' },
  { cat:'earthworks', name:'MS Pipes & Couplers',        count:'70', unit:'Sets',    img:TM_IMG_BASE+'5f7f8d86e5e5653e7d64a3ecf802369972ac7d61.jpg', desc:'Scaffolding pipes and couplers for structural support during casting and finishing.' },

  // Cutting, Drilling & Finishing
  { cat:'cutting',    name:'Hammer Drill Machines',      count:'13', unit:'Units',   img:TM_IMG_BASE+'4182546073fc9501fa8c48c5f9eaa3ec028814d7.jpg', desc:'High-torque rotary drills for reinforced concrete, anchor installation, and structural work.' },
  { cat:'cutting',    name:'Core Cutting Machines',      count:'4',  unit:'Units',   img:TM_IMG_BASE+'ac620a3b769b3bfcd2de510b29360f666ed5f579.jpg', desc:'Precision core extraction for structural testing and cleanly-cut service holes.' },
  { cat:'cutting',    name:'Bar Cutting Machines',       count:'3',  unit:'Units',   img:TM_IMG_BASE+'ded8842fb8c64264e6c7f8f3e235553b8bda103f.jpg', desc:'Fast, accurate cutting of reinforcement steel up to 32mm diameter.' },
  { cat:'cutting',    name:'Floor Grinders & Polishers', count:'4',  unit:'Units',   img:TM_IMG_BASE+'c3739dd66bdcdb2063b281b52493880f0a17b529.jpg', desc:'Surface preparation and high-gloss finish for industrial and commercial flooring.' },
  { cat:'cutting',    name:'VDC Flooring Sets',          count:'6',  unit:'Sets',    img:TM_IMG_BASE+'5b26becf218bdca9b87c5dad16f0a9b425f33d03.jpg', desc:'Vacuum-dewatered concrete flooring kits for high-abrasion industrial surfaces.' },

  // Material Handling
  { cat:'material',   name:'Material Lifts with Trolley',count:'4',  unit:'Units',   img:TM_IMG_BASE+'90606a3d829ba38c39f4d7923d03367fabacca57.jpg', desc:'Vertical lifts for mid-rise material transport on active construction sites.' },
  { cat:'material',   name:'Monkey Lifts',               count:'5',  unit:'Units',   img:TM_IMG_BASE+'6a898337d136cc88c09821ebd1d116352d78f61d.jpg', desc:'Compact pulley-driven lifts for quick vertical transfer of bags, tools, and light material.' },
  { cat:'material',   name:'Pickup Loading Vehicles',    count:'3',  unit:'Vehicles',img:TM_IMG_BASE+'21c5b969a71627e1ba127156b32b684355d9f409.jpg', desc:'Site-to-site material transfer and rapid on-demand deliveries across projects.' },
  { cat:'material',   name:'Fleet Vehicles',             count:'8',  unit:'Vehicles',img:TM_IMG_BASE+'39ba2ff3e04c8020db163e49a6a5eafe044f5060.jpg', desc:'Pickups, trucks, and utility vehicles for logistics, inspection, and supervision.' },

  // Fabrication & Welding
  { cat:'fabrication',name:'Compression Testing Machine',count:'1',  unit:'Unit',    img:TM_IMG_BASE+'a7b86b65cefc30724602367c3e6c2dca34fa5ae4.jpg', desc:'Universal machine for in-house concrete cube and cylinder testing to IS 516 standards.' },
  { cat:'fabrication',name:'Welding Transformers',       count:'Multi',unit:'Units',  img:TM_IMG_BASE+'3c96a2f767d052035042b0ea7d15163efcd3f4c4.jpg', desc:'Site power transformers for continuous welding, cutting, and heavy-equipment operations.' },
  { cat:'fabrication',name:'Gas Torch Cutting Sets',     count:'Multi',unit:'Sets',   img:TM_IMG_BASE+'0e64a448c28a78aae405c806851596c242b22546.jpg', desc:'Rectifier oxy-fuel torch systems for precision steel cutting on-site.' },
  { cat:'fabrication',name:'Plate Bending Machines',     count:'Multi',unit:'Units',  img:TM_IMG_BASE+'8a993742422c643fd5561d4447d785926ba90da4.jpg', desc:'Fabrication of curved steel plates for custom structural elements and shells.' },

  // Surveying & QA Lab
  { cat:'qa',         name:'Field Testing Labs',         count:'Full',unit:'Lab',     img:TM_IMG_BASE+'4f704e6f9d584e347889e4a2c41cffec3d5bef4b.jpg', desc:'Full on-site QA labs for immediate concrete, aggregate, and soil testing.' },
  { cat:'qa',         name:'Sieve Analysis Set',         count:'1',  unit:'Set',     img:TM_IMG_BASE+'4d0086af798b41f00ee686d1753b176ff369ee49.jpg', desc:'Gradation analysis of coarse and fine aggregates to IS standards.' },
  { cat:'qa',         name:'Sieve Shaker',               count:'1',  unit:'Unit',    img:TM_IMG_BASE+'0075388302478d590eae32da405e66ceba61b576.jpg', desc:'Automated shaking for consistent, repeatable aggregate gradation tests.' },
  { cat:'qa',         name:'Drying Oven',                count:'1',  unit:'Unit',    img:TM_IMG_BASE+'837866dc053d46e146243f60e69fe9be7a9ba8ad.jpg', desc:'Moisture-content determination for aggregates, soils, and concrete samples.' },
  { cat:'qa',         name:'Auto Level & Dumpy Level',   count:'1',  unit:'Set',     img:TM_IMG_BASE+'094ad5f2a1f8706ffd1ef4725197bb0229d4ee36.jpg', desc:'Precision leveling and height measurement across the site.' },
  { cat:'qa',         name:'Electronic Weighing Machine',count:'1',  unit:'Unit',    img:TM_IMG_BASE+'060d6ae9db34d32044541e014004c48686f1bf0b.jpg', desc:'Accurate batch weighing for mix design and material tracking.' },
  { cat:'qa',         name:'Measuring Jars',             count:'Set',unit:'',        img:TM_IMG_BASE+'71aba75ff433f5b94fc6b661dafab4eddac9278e.jpg', desc:'Volumetric measurement for admixtures and water-cement ratio calibration.' },
  { cat:'qa',         name:'Gauges & Callipers',         count:'Set',unit:'',        img:TM_IMG_BASE+'a0235868ab19a6fb4cef876d5d86c347ca8bc308.jpg', desc:'Screw gauges and vernier callipers for dimension verification of reinforcement and fixtures.' },
  { cat:'qa',         name:'Trowel & Spatula',           count:'Set',unit:'',        img:TM_IMG_BASE+'64e482f03d2647f27c968de229267b75c87963f5.jpg', desc:'Manual finishing and application of concrete, mortar, and bonding agents.' },
  { cat:'qa',         name:'L-Box Apparatus',            count:'1',  unit:'Set',     img:TM_IMG_BASE+'f6ce0a78ad3a76e8221ed9798a3e3f19ee0d0fe9.jpg', desc:'Self-compacting concrete passing-ability test.' },
  { cat:'qa',         name:'V-Funnel',                   count:'1',  unit:'Unit',    img:'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/V-funnel_test_for_Self-compacting_concrete.jpg/800px-V-funnel_test_for_Self-compacting_concrete.jpg', desc:'Self-compacting concrete flow-time measurement.' },
  { cat:'qa',         name:'Hydrometer',                 count:'1',  unit:'Unit',    img:TM_IMG_BASE+'1de288e462675abfff7c4c61286046daf7126464.jpg', desc:'Density and specific-gravity measurement for liquids and suspensions.' },
  { cat:'qa',         name:'Slump Apparatus',            count:'1',  unit:'Set',     img:TM_IMG_BASE+'dfb633bc2e09bc82437ecab5bc50779bc5783410.jpg', desc:'Workability measurement of fresh concrete to IS 1199 standards.' }
];

function renderToolsPage() {
  const grid = document.getElementById('tmGrid');
  if (!grid) return;

  // Hero stats
  const heroStats = document.getElementById('tmHeroStats');
  if (heroStats) {
    heroStats.innerHTML = `
      <div class="tm-stat"><span class="tm-stat-num"><span class="jn-counter" data-target="${TM_EQUIPMENT.length}" data-suffix="+">0+</span></span><span class="tm-stat-lbl">Equipment Types</span></div>
      <div class="tm-stat"><span class="tm-stat-num">${TM_CATEGORIES.length}</span><span class="tm-stat-lbl">Categories</span></div>
      <div class="tm-stat"><span class="tm-stat-num">1 Lakh+</span><span class="tm-stat-lbl">Sq.Ft Shuttering</span></div>
      <div class="tm-stat"><span class="tm-stat-num">100<span style="font-size:0.55em">%</span></span><span class="tm-stat-lbl">Owned Fleet</span></div>
    `;
  }

  // Category pills
  const pillsWrap = document.getElementById('tmPills');
  if (pillsWrap) {
    pillsWrap.innerHTML = `
      <button class="tm-pill is-active" data-cat="all">All <span class="tm-pill-count">${TM_EQUIPMENT.length}</span></button>
      ${TM_CATEGORIES.map(c => `
        <button class="tm-pill" data-cat="${c.id}">
          ${c.label.split(' ')[0]}
          <span class="tm-pill-count">${TM_EQUIPMENT.filter(x => x.cat === c.id).length}</span>
        </button>`).join('')}
    `;
  }

  // Equipment cards
  const catMap = Object.fromEntries(TM_CATEGORIES.map(c => [c.id, c]));
  grid.innerHTML = TM_EQUIPMENT.map(item => {
    const cat = catMap[item.cat];
    const searchBlob = (item.name + ' ' + item.desc + ' ' + cat.label).toLowerCase();
    return `
      <article class="tm-card" data-cat="${item.cat}" data-search="${searchBlob}">
        <div class="tm-card-media">
          <img src="${item.img}" alt="${item.name} — SLM Construction equipment" loading="lazy" onerror="this.parentElement.classList.add('tm-card-media--fallback');this.remove();" />
          <div class="tm-card-icon" aria-hidden="true">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">${cat.icon}</svg>
          </div>
        </div>
        <div class="tm-card-body">
          <span class="tm-card-badge">${item.count}${item.unit ? ' <em>' + item.unit + '</em>' : ''}</span>
          <h3 class="tm-card-name">${item.name}</h3>
          <p class="tm-card-desc">${item.desc}</p>
          <p class="tm-card-cat">${cat.label}</p>
        </div>
      </article>
    `;
  }).join('');

  _initToolsFilters();

  // Counter animation (reuse Journey's counter class)
  const counters = document.querySelectorAll('.jn-counter');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && e.target.dataset.done !== '1') {
        e.target.dataset.done = '1';
        const t = parseInt(e.target.dataset.target, 10);
        const suffix = e.target.dataset.suffix || '';
        const start = performance.now();
        (function tick(now) {
          const p = Math.min(1, (now - start) / 1500);
          const eased = 1 - Math.pow(1 - p, 3);
          e.target.textContent = Math.round(t * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        })(start);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => obs.observe(c));
}

function _initToolsFilters() {
  const pills  = document.querySelectorAll('.tm-pill');
  const search = document.getElementById('tmSearch');
  const cards  = document.querySelectorAll('.tm-card');
  const empty  = document.getElementById('tmEmpty');
  const count  = document.getElementById('tmResultCount');
  let activeCat = 'all';
  let query = '';

  function apply() {
    let visible = 0;
    cards.forEach(card => {
      const catOK    = activeCat === 'all' || card.dataset.cat === activeCat;
      const searchOK = !query || card.dataset.search.includes(query);
      const show = catOK && searchOK;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    if (empty) empty.classList.toggle('is-hidden', visible > 0);
    if (count) count.textContent = visible + ' result' + (visible !== 1 ? 's' : '');
  }

  pills.forEach(p => {
    p.addEventListener('click', () => {
      pills.forEach(x => x.classList.remove('is-active'));
      p.classList.add('is-active');
      activeCat = p.dataset.cat;
      apply();
    });
  });
  if (search) {
    search.addEventListener('input', e => {
      query = e.target.value.toLowerCase().trim();
      apply();
    });
  }
  apply();
}

/* ═══════════════════════════════════════
   PAGE ROUTER
═══════════════════════════════════════ */
(function pageRouter() {
  const path   = location.pathname.toLowerCase();
  const params = new URLSearchParams(location.search);
  const body   = document.body;

  if (body.classList.contains('page-projects') || path.endsWith('/projects.html') || path.endsWith('projects.html')) {
    const cat = params.get('category') || 'Industrial';
    renderProjectsPage(cat);
  } else if (body.classList.contains('page-project') || path.endsWith('/project.html') || path.endsWith('project.html')) {
    const id = params.get('id');
    if (id) renderProjectPage(id);
  } else if (body.classList.contains('page-tools') || path.endsWith('/tools.html') || path.endsWith('tools.html')) {
    renderToolsPage();
    _initPrjStickyBar();
    document.body.classList.add('has-prj-sticky-bar');
  } else if (body.classList.contains('page-journey')) {
    initJourneyAnimations();
  } else if (body.classList.contains('page-leadership')) {
    initLeadershipTilt();
  }
})();

/* ═══════════════════════════════════════
   SCROLL PARALLAX — images + text (site-wide)
   Opt-in via:  img[data-parallax]  /  [data-parallax-text]
   GPU transforms only; respects reduced-motion.
═══════════════════════════════════════ */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let imgs = [], texts = [], poss = [], ticking = false;

  function collect() {
    imgs  = Array.from(document.querySelectorAll('img[data-parallax]'));
    texts = Array.from(document.querySelectorAll('[data-parallax-text]'));
    poss  = Array.from(document.querySelectorAll('[data-parallax-pos]'));
  }

  function update() {
    ticking = false;
    const vh = window.innerHeight;
    for (const el of imgs) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -160 || r.top > vh + 160) continue;
      const sp = parseFloat(el.getAttribute('data-parallax')) || 0.16;
      const center = r.top + r.height / 2;
      let off = (vh / 2 - center) * sp;
      const cap = r.height * 0.08;                 // stay inside the 1.16x scale slack
      off = Math.max(-cap, Math.min(cap, off));
      el.style.setProperty('--py', off.toFixed(1) + 'px');
    }
    for (const el of texts) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -160 || r.top > vh + 160) continue;
      const sp = parseFloat(el.getAttribute('data-parallax-text')) || 0.06;
      const center = r.top + r.height / 2;
      let off = (vh / 2 - center) * sp;
      off = Math.max(-28, Math.min(28, off));
      el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
    }
    // Position-shift parallax (object-position / background-position) —
    // safe for images that already use a hover transform (no conflict, no overflow).
    for (const el of poss) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -160 || r.top > vh + 160) continue;
      const sp = parseFloat(el.getAttribute('data-parallax-pos')) || 0.12;
      const center = r.top + r.height / 2;
      let off = (vh / 2 - center) * sp;
      off = Math.max(-30, Math.min(30, off));        // keep within the cover-crop slack
      el.style.setProperty('--ppos', off.toFixed(1) + 'px');
    }
  }

  function onScroll() { if (!ticking) { requestAnimationFrame(update); ticking = true; } }
  function init() { collect(); if (imgs.length || texts.length || poss.length) update(); }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { collect(); update(); }, { passive: true });
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
  setTimeout(init, 900);   // re-collect after JS-rendered grids (projects/tools) mount
})();
