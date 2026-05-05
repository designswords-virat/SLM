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
   SITE LOADER — shows once per session on first page load,
   stays for min 1.3s so the animation reads, then fades out
═══════════════════════════════════════ */
(function siteLoader() {
  const loader = document.getElementById('siteLoader');
  if (!loader) return;

  // If already shown in this session, skip immediately
  try {
    if (sessionStorage.getItem('slm-loader-done') === '1') {
      loader.classList.add('no-show');
      return;
    }
  } catch (_) { /* sessionStorage blocked; just show it */ }

  const MIN_SHOW = 1300;
  const start = performance.now();
  let hidden = false;

  function hide() {
    if (hidden) return;
    const elapsed = performance.now() - start;
    const wait = Math.max(0, MIN_SHOW - elapsed);
    setTimeout(() => {
      if (hidden) return;
      hidden = true;
      loader.classList.add('is-hidden');
      try { sessionStorage.setItem('slm-loader-done', '1'); } catch (_) {}
      setTimeout(() => loader.remove(), 700);
    }, wait);
  }

  if (document.readyState === 'complete') hide();
  else window.addEventListener('load', hide);

  // Hard fallback: don't hold visitors hostage if something stalls
  setTimeout(hide, 5000);
})();

// ── AOS
AOS.init({ once: true, duration: 680, easing: 'ease-out-quad', offset: 55 });

/* ═══════════════════════════════════════
   NAV, scroll + mobile
═══════════════════════════════════════ */
const navbar  = document.getElementById('navbar');
const backTop = document.getElementById('backTop');

window.addEventListener('scroll', () => {
  const y = window.scrollY;
  // Only home toggles transparent <-> scrolled; sub-pages stay solid (is-subpage marker set by chrome.js)
  if (navbar && !navbar.classList.contains('is-subpage')) {
    navbar.classList.toggle('scrolled', y > 60);
  }
  if (backTop) backTop.classList.toggle('is-visible', y > 500);
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
   Uses inline style transitions, no CSS class conflicts
═══════════════════════════════════════ */
const WORDS   = ['Industrial', 'Hospitality', 'Institutional', 'Commercial', 'Residential', 'Public Works', 'Trust'];
const wordEl  = document.getElementById('cyclingWord');
const catRows = document.querySelectorAll('.cat-row');
let   wordIdx = 0;

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
  setTimeout(done, 330);
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
  const isTrust = WORDS[wordIdx] === 'Trust';
  setTimeout(step, isTrust ? 2800 : 1900);
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

// Initial state, show first word, highlight first cat
if (wordEl) {
  wordEl.style.transform = 'translateY(0)';
  wordEl.style.opacity   = '1';
  highlightCat(0);
  setTimeout(step, 2000);
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
   FLAGSHIP — PINNED CINEMA REEL (desktop) / stacked cards (mobile)
   Scroll-scrubbed cross-fade between project panels with Ken-Burns
   hold, caption swap, and orange progress rail. On mobile (< lg)
   panels render as normal-flow cards with no scroll math.
═══════════════════════════════════════ */
(function initCinemaReel() {
  const sec = document.getElementById('flagship');
  if (!sec || !sec.classList.contains('cr-section')) return;

  const panels = sec.querySelectorAll('.cr-panel');
  const imgs   = sec.querySelectorAll('.cr-panel > .cr-img');
  const fill   = document.getElementById('crRailFill');
  const num    = document.getElementById('crCountNum');
  const N      = panels.length;
  if (!N) return;

  // Section is N viewport-heights of pinned scroll. Set CSS var so the
  // height calc stays in sync if N ever changes.
  sec.style.setProperty('--cr-panels', N);

  let lastActive = -1;
  let raf = 0;
  let pendingProg = 0;

  function render() {
    raf = 0;
    const prog      = pendingProg;
    const idxF      = Math.min(N - 1, prog * N);
    const activeIdx = Math.min(N - 1, Math.floor(idxF));
    const localProg = idxF - activeIdx;       // 0..1 inside the active panel
    const FADE_AT   = 0.78;                   // last 22% of each panel = transition

    for (let i = 0; i < N; i++) {
      const img = imgs[i];
      if (!img) continue;
      let opacity = 0;
      let scale   = 1;
      if (i === activeIdx) {
        opacity = localProg < FADE_AT ? 1 : 1 - (localProg - FADE_AT) / (1 - FADE_AT);
        scale   = 1 + 0.045 * localProg;       // gentle Ken-Burns drift
      } else if (i === activeIdx + 1) {
        opacity = localProg < FADE_AT ? 0 : (localProg - FADE_AT) / (1 - FADE_AT);
        scale   = 1.02;
      } else if (i < activeIdx) {
        scale = 1.045;
      }
      img.style.opacity   = opacity.toFixed(3);
      img.style.transform = `scale(${scale.toFixed(4)})`;
    }

    if (activeIdx !== lastActive) {
      for (let i = 0; i < panels.length; i++) {
        panels[i].classList.toggle('is-active', i === activeIdx);
      }
      if (num) num.textContent = String(activeIdx + 1).padStart(2, '0');
      lastActive = activeIdx;
    }

    if (fill) fill.style.transform = `scaleX(${prog.toFixed(4)})`;
  }

  function clearDesktopStyles() {
    imgs.forEach(img => { img.style.opacity = ''; img.style.transform = ''; });
    panels.forEach(p => p.classList.remove('is-active'));
    if (fill) fill.style.transform = '';
  }

  function onScroll() {
    // Mobile (< lg): all panels render as plain cards. Strip any
    // inline styles the desktop reel might have set.
    if (window.innerWidth < 1024) {
      if (lastActive !== -2) {
        clearDesktopStyles();
        lastActive = -2;
      }
      return;
    }
    const r       = sec.getBoundingClientRect();
    const totalSc = sec.offsetHeight - window.innerHeight;
    const prog    = Math.max(0, Math.min(1, -r.top / totalSc));
    pendingProg   = prog;
    if (!raf) raf = requestAnimationFrame(render);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
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
    img:'https://slmindia.in/wp-content/uploads/2025/09/beb2d05252f88d21f5be24845d680f4de012b285-1-1024x576.jpg',
    desc:'Complete civil development of industrial sheds for production operations, administrative blocks, utility structures and site-wide infrastructure for a non-ferrous metal production facility at Sargoth, Reengus.' },

  { id:'hi-growth', category:'Industrial', name:'Hi-Growth International', client:'Hi-Growth International', location:'Kalwada, Mahindra SEZ', area:'Industrial Facility', year:'2024–25',
    img:'https://slmindia.in/wp-content/uploads/2025/10/3a45abe3b0ddf6c8c0aae733cf4f95c6b88b097a-1024x555.png',
    desc:'Cold storage and industrial facility construction with structural works for manufacturing and administrative areas within the Mahindra SEZ at Kalwada.' },

  { id:'universal-auto-iii', category:'Industrial', name:'Universal Autofoundry Unit-III', client:'Universal Autofoundry Ltd.', location:'Sargoth, Reengus, Rajasthan', area:'Industrial Facility', year:'2023–24',
    img:'https://slmindia.in/wp-content/uploads/2025/10/8662056b3f180718e399fe21fa134d44d6074e7b-1024x556.png',
    desc:'Complete civil construction of production sheds, utility structures and site infrastructure for auto component manufacturing at Sargoth, Reengus.' },

  { id:'paavan-products', category:'Industrial', name:'Paavan Products Bichoon Unit', client:'Paavan Products Pvt. Ltd.', location:'Bichoon, Rajasthan', area:'Industrial Shed', year:'2023–24',
    img:'https://slmindia.in/wp-content/uploads/2025/10/a359075677c331a13d5c54e7a862d918dcf4e0be-1024x556.png',
    desc:'Industrial shed for production and storage with administrative spaces and complete site development for manufacturing operations at Bichoon.' },

  { id:'precision-auto', category:'Industrial', name:'Precision Autocastings Unit II', client:'Precision Autocastings Pvt. Ltd.', location:'Kaladera, Chomu, Rajasthan', area:'2,00,000 sq.ft', year:'2023–24',
    img:'https://slmindia.in/wp-content/uploads/2025/10/0c0bc81c21f8fff393aa34cb0c698846e72eda08-scaled-1-1024x556.png',
    desc:'Complete civil development of large-scale production sheds for foundry operations, utility structures and site infrastructure spanning 2,00,000 sq.ft at Kaladera, Chomu.' },

  { id:'oswal-cables', category:'Industrial', name:'Oswal Cables Bagru Unit', client:'Oswal Cables', location:'Bagru Extension II, Jaipur', area:'Industrial Complex', year:'2019–20',
    img:'https://slmindia.in/wp-content/uploads/2025/10/ff837b04dd9ae936b26065d49128bc7da4414bc5-1024x556.png',
    desc:'Complete civil development of industrial sheds for cable manufacturing, office block and internal infrastructure at Bagru Extension II, Jaipur.' },

  { id:'universal-auto-ii', category:'Industrial', name:'Universal Autofoundry Unit-II', client:'Universal Autofoundry Ltd.', location:'SKS Industrial Area, Reengus', area:'Industrial Facility', year:'2018–19',
    img:'https://slmindia.in/wp-content/uploads/2025/10/76751cac89b445550e19c979eebeb14c5a6c58bc-1024x556.png',
    desc:'Full civil development with heavy-duty production sheds, administrative areas and comprehensive site infrastructure for auto component foundry operations at Reengus.' },

  { id:'arl-infratech', category:'Industrial', name:'ARL Infratech', client:'ARL Infratech Ltd.', location:'Bagru, Jaipur', area:'Manufacturing Facility', year:'2011–12',
    img:'https://slmindia.in/wp-content/uploads/2025/10/05d4c1abf517bab682af11ba4e70c2c5f665caf2-1024x556.png',
    desc:'Cement sheet and pipe manufacturing facility with industrial sheds, utility blocks and site infrastructure for a building materials manufacturer at Bagru, Jaipur.' },

  { id:'sigma-j1', category:'Industrial', name:'Sigma Engineered Solutions J1 Unit', client:'Ultratech Metals (India) Pvt. Ltd.', location:'VKIA Industrial Area, Jaipur', area:'Factory Shed', year:'2005–06',
    img:'https://slmindia.in/wp-content/uploads/2025/10/25be90fcc5289816c531b5f0a4531107ed75ee17-1024x556.png',
    desc:'Factory shed construction for precision manufacturing with structural framework and complete utility infrastructure at VKIA Industrial Area, Jaipur.' },

  { id:'mayur-uniquoters-ind', category:'Industrial', name:'Mayur Uniquoters', client:'Mayur Uniquoters Ltd.', location:'Jaitpura, Jaipur', area:'Manufacturing Facility', year:'1993–94',
    img:'https://slmindia.in/wp-content/uploads/2025/10/a0af4c45cb47802a5b29085a954974f082735b94-1024x556.png',
    desc:'Manufacturing sheds and godowns for synthetic leather production facility at Jaitpura, one of SLM\'s long-standing industrial partnerships spanning three decades.' },

  { id:'ankit-roofing', category:'Industrial', name:'Ankit Roofing Unit', client:'ARL Infratech Ltd.', location:'Bagru, Jaipur', area:'Industrial Shed', year:'2005–06',
    img:'https://slmindia.in/wp-content/uploads/2025/10/49da84d19017f90b8f76da8be9d111070c03e1ca-1024x556.png',
    desc:'Industrial shed for roofing materials manufacturing with site infrastructure, utility networks and administrative facilities at Bagru, Jaipur.' },

  { id:'vinayak-jewels', category:'Industrial', name:'Vinayak Jewels India', client:'Vinayak Jewels India Pvt. Ltd.', location:'Sitapura SEZ, Jaipur', area:'Production Facility', year:'2006–07',
    img:'https://slmindia.in/wp-content/uploads/2025/10/70d37752fc9f06a1be161159fad3a943ca366ea4-1-1024x556.png',
    desc:'Production sheds for jewellery manufacturing within SEZ guidelines at Sitapura, built to comply with Special Economic Zone standards and export regulations.' },

  { id:'autolite', category:'Industrial', name:'Autolite India Ltd.', client:'Autolite India Ltd.', location:'Bindayaka, Rajasthan', area:'Factory Complex', year:'1994–97',
    img:'https://slmindia.in/wp-content/uploads/2025/10/04cfe3bc6c5376a8e47d33fba948568d0936cf6e-1024x556.png',
    desc:'Factory shed and utility infrastructure for lighting equipment manufacturing at Bindayaka, one of SLM\'s key industrial projects from the 1990s.' },

  { id:'pacific-granites', category:'Industrial', name:'Pacific Granites', client:'Pacific Industries Ltd.', location:'RIICO Industrial Area, Sukher, Udaipur', area:'Processing Plant', year:'1990–91',
    img:'https://slmindia.in/wp-content/uploads/2025/10/3cb863cb451604e3da557969512c25ad014a213f-1024x556.png',
    desc:'Granite processing plant with specialised heavy-duty foundations for large machinery at RIICO Industrial Area, Sukher, Udaipur.' },

  { id:'reil-kanakpura', category:'Industrial', name:'REIL Kanakpura', client:'Rajasthan Electronics & Instruments Ltd.', location:'Kanakpura, Jaipur', area:'Electronics Facility', year:'1983–89',
    img:'https://slmindia.in/wp-content/uploads/2025/10/ccbbd6e7063035db0b9e9384e5b9c461f316d69c-1024x556.png',
    desc:'Electronics manufacturing sheds, utility structures and site infrastructure for REIL at Kanakpura, one of SLM\'s earliest large-scale industrial assignments, spanning six years from 1983 to 1989.' },

  { id:'microtek-sitapura', category:'Industrial', name:'Microtek International (Sitapura)', client:'Microtek International', location:'Sitapura, Jaipur', area:'Manufacturing Unit', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/10/0921465ad83b7624ca3bbde3081150f63ea849b7-1024x556.png',
    desc:'Manufacturing and assembly facility for electronics products at Sitapura Industrial Area, featuring industrial sheds and complete support infrastructure.' },

  { id:'vaibhav-global', category:'Industrial', name:'Vaibhav Global Ltd.', client:'Vaibhav Global Ltd.', location:'Jaipur, Rajasthan', area:'Industrial Facility', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/10/892bfa0001ae235aba334357a7ac17f30659a7c0-1-1024x556.png',
    desc:'Industrial facility for a leading global fashion jewellery and lifestyle products company, featuring production sheds, office infrastructure and complete site development at Jaipur.' },

  { id:'kec-ind', category:'Industrial', name:'KEC International Ltd.', client:'KEC International Ltd.', location:'Rajasthan', area:'Operations Facility', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/10/3fb973a855ce7515b9593b1717184b4d7c2de930-1-1024x556.png',
    desc:'Operations and infrastructure facility for KEC International, a global infrastructure EPC company, covering structural works, administrative blocks and complete site development.' },

  { id:'microtek-bassi', category:'Industrial', name:'Microtek International (Bassi)', client:'Microtek International', location:'Bassi, Jaipur', area:'Manufacturing Unit', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/10/0921465ad83b7624ca3bbde3081150f63ea849b7-1024x556.png',
    desc:'Manufacturing facility for electronics products at Bassi, featuring industrial sheds, production spaces and complete utility infrastructure to support operations.' },

  // ════════════════════════════════
  //  HOSPITALITY  (9 projects)
  // ════════════════════════════════
  { id:'oberoi-vanyavilas', category:'Hospitality', name:'The Oberoi Vanyavilas Wildlife Resorts', client:'EIH Ltd.', location:'Ranthambore, Sawai Madhopur', area:'65,000 sq.ft', year:'2000–01',
    img:'https://slmindia.in/wp-content/uploads/2025/09/b221a8a76143e2a24b678d9222a0b0c575b97849-1024x576.jpg',
    desc:'An ultra-luxury 5-star wildlife resort developed across 20 acres, inspired by royal caravans. SLM executed tented accommodations with heritage detailing, spa, restaurant, wellness zones, staff quarters and complete internal roads and drainage infrastructure.' },

  { id:'stardom-resort', category:'Hospitality', name:'Stardom Resort', client:'SSG Kailash Hotels & Resorts', location:'Bhankrota, Jaipur', area:'50,000 sq.ft', year:'2019–20',
    img:'https://slmindia.in/wp-content/uploads/2025/10/4506724d3cfa65c3222e66c8d3e31e202301e02b-1-1024x576.png',
    desc:'Modern resort featuring 75 elegantly designed rooms, a bar, restaurant and related infrastructure. Works included luxury guest rooms, restaurant and bar block, utility infrastructure and internal road development at Bhankrota, Jaipur.' },

  { id:'hotel-allied-mahendra', category:'Hospitality', name:'Hotel Allied Mahendra', client:'Mahendra Group Jewellery & Gems', location:'Thikariya, Jaipur', area:'48,000 sq.ft', year:'2015–17',
    img:'https://slmindia.in/wp-content/uploads/2025/10/c2c0ad9768b4ee5d0b6c02aae36b2e6279571e77-1024x576.jpg',
    desc:'A 100-room business hotel with grand banquet hall and landscaped surroundings. SLM delivered the complete hotel block with banquet and conference hall, structural finishing, site landscaping and guest service infrastructure at Thikariya, Jaipur.' },

  { id:'westin-pushkar', category:'Hospitality', name:'The Westin Pushkar Resort & Spa', client:'Paradise Group', location:'Pushkar, Rajasthan', area:'Luxury Resort', year:'2014–16',
    img:'https://slmindia.in/wp-content/uploads/2025/10/5cdb493112b6917c60635d70a0cd70cc315d6169-1-1024x576.png',
    desc:'A 5-star wellness resort nestled in the Aravallis featuring 98 luxury guestrooms and villas with private plunge pools, a wellness spa and landscaped views. SLM delivered full infrastructure execution for the entire resort at Pushkar.' },

  { id:'hotel-paradise', category:'Hospitality', name:'Hotel Paradise (Ramada by Wyndham)', client:'Paradise Group', location:'Sikar Road, Jaipur', area:'80,000 sq.ft', year:'2007–08',
    img:'https://slmindia.in/wp-content/uploads/2025/10/4279f4a66badc993a2b2fe7237408e6a2638e435-1-1024x576.jpg',
    desc:'A 9-storey premium hotel featuring 108 rooms and allied hospitality facilities. SLM built the multi-storey structure with modern façade, guest rooms, banquet and service areas with full structural and MEP integration.' },

  { id:'gold-palace', category:'Hospitality', name:'The Gold Palace and Resorts', client:'M/s Kishanpura Hotels Pvt. Ltd.', location:'Kukas, Jaipur', area:'86,000 sq.ft', year:'1999–2000',
    img:'https://slmindia.in/wp-content/uploads/2025/10/d1abc614572c9cd5df25c6e883ba6151898c2ed9-1-1024x682.jpg',
    desc:'A premium resort combining Mughal-era landscaping with Rajasthani architecture across 13 acres. Features 68 guest rooms with heritage façade, banquet halls, restaurants, spa facilities and recreational zones at Kukas, Jaipur.' },

  { id:'hotel-gajner', category:'Hospitality', name:'Hotel Gajner Palace', client:'HRH Group of Hotels', location:'Bikaner, Rajasthan', area:'Heritage Property', year:'1999–2000',
    img:'https://slmindia.in/wp-content/uploads/2025/10/e2634ace8a508a7e7b8afb65d8a390cfbbc01d5f-1024x576.jpg',
    desc:'Heritage conservation and civil development within an iconic palace property in Bikaner, adding modern hospitality facilities while preserving its royal legacy, including spa, utility infrastructure and a kitchen block.' },

  { id:'hotel-gaudavan', category:'Hospitality', name:'Hotel Gaudavan', client:'Gaudavan Pvt. Ltd.', location:'Muhana, Sanganer, Jaipur', area:'Hotel Complex', year:'2004–05',
    img:'https://slmindia.in/wp-content/uploads/2025/10/934d221e4618399d606318e628eeab90fb5d62b4-1024x576.png',
    desc:'Turnkey development including full civil, electrical and plumbing works with landscaping and site infrastructure at Muhana, Sanganer, delivered as a complete ready-to-operate property.' },

  { id:'gorbandh-palace', category:'Hospitality', name:'Gorbandh Palace (Taj)', client:'HRH Group of Hotels', location:'Jaisalmer, Rajasthan', area:'Heritage Resort', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/10/ac7f73c38b6248e219701f1a9c8465b81bb6bad2-1024x585.png',
    desc:'Royal-style heritage resort in Jaisalmer featuring heritage sandstone architecture, luxury guest rooms and dining areas, spa and recreational infrastructure with traditionally-detailed civil work befitting a Taj property.' },

  // ════════════════════════════════
  //  INSTITUTIONAL  (8 projects)
  // ════════════════════════════════
  { id:'hare-krishna', category:'Institutional', name:'Gupt Vrindavan Dham', client:'Hare Krishna Movement', location:'Hare Krishna Marg, Jagatpura, Jaipur', area:'2,00,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/f7af9c5e16aa703aee16ab27846bfb3150abd216-1024x576.jpg',
    desc:'Religious and cultural complex spanning 6 acres with a 17-storey temple, 25,000 sq.ft prayer hall with ornate gateway and exhibition spaces. SLM handled structural execution integrating conventional design with contemporary construction techniques.' },

  { id:'jecrc-ncr', category:'Institutional', name:'JECRC University (NCR Campus)', client:'JECRC University', location:'Matsya Industrial Area, Alwar', area:'1,00,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/3b5352f9c7000c944f6c11e8a2d9e1c16b9df9ab.jpg',
    desc:'Retrofitting and renovation of existing structures for the northern region expansion campus at Alwar. Works encompassed structural reinforcement, exterior restoration and mechanical/electrical systems upgrades.' },

  { id:'digambar-jain', category:'Institutional', name:'Digambar Jain Shraman Sanskriti Sansthan', client:'Digambar Jain Shraman Sanskriti Sansthan', location:'Sanganer, Jaipur', area:'80,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/c1acec93bcfc0628f75454dfa764906e95a5663f.png',
    desc:'G+4 spiritual retreat facility combining residential quarters and learning spaces for religious scholars and practitioners at Sanganer, Jaipur.' },

  { id:'vipra-foundation', category:'Institutional', name:'Vipra Foundation', client:'Vipra Foundation', location:'Mansarovar, Jaipur', area:'60,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/0e6f966f0416b7ad818ff3d7cca564b0a505bbc6-1024x768.jpg',
    desc:'Six-level research and educational hub emphasizing Vedic scholarship and skill advancement for community development, at Mansarovar, Jaipur.' },

  { id:'jnit-campus', category:'Institutional', name:'JNIT Campus', client:'Jagan Nath University', location:'Sitapura Industrial Area, Jaipur', area:'1,00,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/dcd49bec3fde3d957c78230edd8076cabdf4c741.jpg',
    desc:'Engineering institute development with classroom structures, student housing, administrative facilities and infrastructure networks at Sitapura Industrial Area, Jaipur.' },

  { id:'jagannath-chaksu', category:'Institutional', name:'Jagan Nath University (Chaksu)', client:'Jagan Institute of Management & Studies', location:'Chaksu, Tonk Road, Jaipur', area:'90,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/f97c363b6f796670e37e05b7d60839d0fe7be6b3-1024x576.jpg',
    desc:'Multi-building campus encompassing teaching facilities, residential quarters and utility infrastructure at Chaksu on Tonk Road, Jaipur.' },

  { id:'gyan-vihar', category:'Institutional', name:'Gyan Vihar University', client:'Gyan Vihar University', location:'Jagatpura, Jaipur', area:'1,00,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/12/Component-94-3.png',
    desc:'Twin 9-storey academic towers with administrative facilities designed for vertical space optimization at Jagatpura, Jaipur, serving thousands of students across engineering and management disciplines.' },

  { id:'jaipur-dental', category:'Institutional', name:'Jaipur Dental College', client:'Jaipur Dental College', location:'Kukas, Jaipur', area:'Educational Campus', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/ebc21a47a146307a6c97423a4bf515b76abbd6bd.jpg',
    desc:'Medical institution development featuring lecture halls, clinical labs, student accommodation and professional-grade infrastructure at Kukas, Jaipur.' },

  // ════════════════════════════════
  //  COMMERCIAL  (3 projects)
  // ════════════════════════════════
  { id:'akshat-nilay-c', category:'Commercial', name:'Akshat Nilay', client:'Akshat Apartments Pvt. Ltd.', location:'Hawa Sadak, Civil Lines, Jaipur', area:'1,55,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/96811a8560010fc2306b3b5eff2533185439d7a0-1024x576.jpg',
    desc:'Complete civil development of an 8-storey residential apartment complex featuring 62 premium units with structural precision, modern elevation and quality finishes at Civil Lines, Jaipur.' },

  { id:'akshat-meadows-c', category:'Commercial', name:'Akshat Meadows Township', client:'Akshat Apartments Pvt. Ltd.', location:'C-Scheme, Jaipur', area:'1,30,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/ef31af097ddf499f86a3e0322684a7d927002e2e-1024x576.jpg',
    desc:'Civil construction of a multi-storey residential apartment building comprising 36 luxury dwellings with reinforced concrete framework and high-end urban living standards at C-Scheme, Jaipur.' },

  { id:'akshat-meadows-2-c', category:'Commercial', name:'Akshat Meadows Township 2', client:'Akshat Apartments Pvt. Ltd.', location:'Sirsi Road, Jaipur', area:'3,19,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/e3c0bdf83246281eb9091a053dcd6d70daaa0511-1024x576.jpg',
    desc:'Complete township combining luxury villas, group housing and lifestyle amenities across 9.81 acres, featuring 120 luxury villas, walk-up apartments, retail centre, tenement blocks and a 15,000 sq.ft clubhouse.' },

  // ════════════════════════════════
  //  RESIDENTIAL  (4 projects)
  // ════════════════════════════════
  { id:'akshat-nilay-r', category:'Residential', name:'Akshat Nilay', client:'Akshat Apartments Pvt. Ltd.', location:'Hawa Sadak, Civil Lines, Jaipur', area:'1,55,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/96811a8560010fc2306b3b5eff2533185439d7a0-1024x576.jpg',
    desc:'Complete civil development of an 8-storey residential apartment complex featuring 62 premium units with structural precision, modern elevation and quality finishes at Civil Lines, Jaipur.' },

  { id:'akshat-meadows-r', category:'Residential', name:'Akshat Meadows Township', client:'Akshat Apartments Pvt. Ltd.', location:'C-Scheme, Jaipur', area:'1,30,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/ef31af097ddf499f86a3e0322684a7d927002e2e-1024x576.jpg',
    desc:'Civil construction of a multi-storey residential apartment building comprising 36 luxury dwellings with reinforced concrete framework and high-end urban living standards at C-Scheme, Jaipur.' },

  { id:'akshat-meadows-2-r', category:'Residential', name:'Akshat Meadows Township 2', client:'Akshat Apartments Pvt. Ltd.', location:'Sirsi Road, Jaipur', area:'3,19,000 sq.ft', year:',',
    img:'https://slmindia.in/wp-content/uploads/2025/11/e3c0bdf83246281eb9091a053dcd6d70daaa0511-1024x576.jpg',
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
  'bright-metal': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/f674b187763cbb2ce5eaeec4e27bf32a2828b9a2-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/fa3908a954b39a312fbbcd761e28636d1728d4cd-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/8ca5929a7ae5e262df9c653a7d1a88b8ab564e26-1024x576.jpg'],
    scope:['Industrial sheds for production operations','Utility structures & site infrastructure','Administrative blocks for smoother workflows','Planned circulation, internal roads & drainage'] },
  'hi-growth': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/a880d983da24ddf5dee4c7fefd838bf8e295a6fb-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/b85ee59506beb97ae3f59a0167e5095b24a14b71-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/e73afc6f219b31b30c27233d657926a218cb2039-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/38a34087998a1693467ae6a66d2a1545433fec6e-1024x576.jpg'],
    scope:['Industrial & storage sheds for cold storage operations','Administrative and service areas','Utility structures & mechanical provisions','Integrated internal road and drainage systems'] },
  'universal-auto-iii': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/b37ff68f1001da6229b29dd4cbb759cd6c807e8f-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/bfb452f8dacf576e5ff0081363c7f8a688ce2aae-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/dfe162edab5eef507d9152d1f529a48bbed82f65-1024x576.jpg'],
    scope:['Industrial sheds with high-capacity production layout','Utility & service structures','Administrative and control rooms','Site infrastructure and internal circulation planning'] },
  'paavan-products': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/f01ed58c3fb3a601408869b4e29ccc8861ce5096-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/0f37e7b240f8e03afcd5927f4f6f1d0eb40fb9b7-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/0516ca2089aa3383f4d5bba816f99a8882cde7f2-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/d82da505fa0349bd8210df64805ee38e0546afe8-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/45fa562805dd3775970a965d62a669fc9b461713-1024x576.jpg'],
    scope:['Industrial shed for production & storage','Administrative and support areas','Internal road network & site development','Utility structures for smooth operations'] },
  'precision-auto': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/image-50.png','https://slmindia.in/wp-content/uploads/2025/10/image-49-2.png','https://slmindia.in/wp-content/uploads/2025/10/Component-95.png','https://slmindia.in/wp-content/uploads/2025/10/image-48-2.png'],
    scope:['Large-scale production sheds for foundry operations','Administrative and support blocks','Utility structures with integrated services','Site-wide infrastructure and internal circulation roads'] },
  'oswal-cables': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/231e9c38bd000715dafa19a5e706c11232a49e1f-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/39e221b37ab209a986a231b5309cba4b98ca121a-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/ae981e99d86dcb5663746b38f9076f0f3b4887c3-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/6b2968bee97d3a12c0a3de0740b93b6befcff4be-1024x576.jpg'],
    scope:['Industrial sheds for cable & conductor production','Dedicated administrative office block','Utility & electrical service structures','Internal roads and drainage systems'] },
  'universal-auto-ii': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/9c1643f83174e72308952ce724f5dfcd7de2dc8f-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/d92e30e0eecf6b6e62a7fba66461a5ca2bc75c61-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/0e24deb976e0eb95705317de4f26971e857da5cf-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/4370a77083fbb8b356b0de3471f3fd5626bed01b-1024x576.jpg'],
    scope:['Heavy-duty industrial sheds','Administrative & operations block','Site infrastructure & internal circulation roads','Utility and drainage development'] },
  'arl-infratech': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/b3d81c782fb91e145c563193e50abee49e1e6c9b-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/3373e6a47b09fc4614d353566f98886a19d921a5-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/8745f13471e63fc5ccdd34a555d032bd73073573-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/76e33f2ed2cf31d2c5cb84dd3953d98f36d5c531-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/56dc0e316a68c08919e2413e28f88155b2069a20-1024x576.jpg'],
    scope:['Industrial sheds for cement product lines','Utility blocks & site infrastructure','Efficient layout for process flow','Civil & structural execution'] },
  'sigma-j1': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/f389d35b59a68aad366182167388e9b912d89514-1024x683.jpg'],
    scope:['Factory shed for precision manufacturing','Site infrastructure & utilities','Structural & civil framework','Optimized layout for operations'] },
  'mayur-uniquoters-ind': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/DJI_20250403095837_0002_D-2-1024x556.png','https://slmindia.in/wp-content/uploads/2025/10/image-49.png','https://slmindia.in/wp-content/uploads/2025/10/image-47.png','https://slmindia.in/wp-content/uploads/2025/10/image-48.png'],
    scope:['Manufacturing sheds & godowns','Utility structures for operations','Internal roads & site development','Durable civil execution'] },
  'ankit-roofing': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/Frame-337-1.png','https://slmindia.in/wp-content/uploads/2025/10/image-49-1.png','https://slmindia.in/wp-content/uploads/2025/10/image-48-1.png'],
    scope:['Industrial shed for roofing manufacturing','Site infrastructure & utilities','Administrative provisions','Civil and structural works'] },
  'vinayak-jewels': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/DJI_20250403095837_0002_D-2-1-1024x543.png','https://slmindia.in/wp-content/uploads/2025/10/60520108fea84fbc78f4eab837d08d6cddf01132.png','https://slmindia.in/wp-content/uploads/2025/10/749c401d22da940a8de16dbe10165e0b1b60cf5a.png','https://slmindia.in/wp-content/uploads/2025/10/b063b90e1189b5fd920e3b6b1b9a8e750ae6fd07.png'],
    scope:['Production sheds for jewellery manufacturing','Utility and service structures','Civil works within SEZ guidelines','Complete site development'] },
  'autolite': { gallery:[], scope:['Factory shed for light component production','Utility & service blocks','Civil and electrical integration','Site-level development'] },
  'pacific-granites': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/DJI_20250403095837_0002_D-2-3-1024x556.png'],
    scope:['Granite processing sheds','Specialized heavy foundations','Industrial layout & site development','Structural works for machinery load'] },
  'reil-kanakpura': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/image-47-1.png','https://slmindia.in/wp-content/uploads/2025/10/image-48-3.png','https://slmindia.in/wp-content/uploads/2025/10/image-49-3.png'],
    scope:['Electronics manufacturing sheds','Utility & service structures','Civil works & site infrastructure','Integrated process layout'] },
  'microtek-sitapura': { gallery:[], scope:['Manufacturing and assembly facility','Industrial sheds with complete support','Utility networks and services','Administrative infrastructure'] },
  'vaibhav-global': { gallery:[], scope:['Industrial facility for fashion jewellery production','Production sheds & office infrastructure','Complete site development','Utility & service infrastructure'] },
  'kec-ind': { gallery:[], scope:['Operations and infrastructure facility','Structural works & administrative blocks','Complete site development','Service infrastructure'] },
  'microtek-bassi': { gallery:[], scope:['Manufacturing and assembly operations','Industrial sheds with full support','Electrical & utility networks','Site development and infrastructure'] },

  // ── HOSPITALITY ──
  'oberoi-vanyavilas': { gallery:[], scope:['Luxury tented accommodations with heritage detailing','Spa, restaurant, and wellness zones amid landscaped greens','Staff quarters & back-of-house facilities','Internal roads, utilities, and drainage infrastructure'] },
  'stardom-resort': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/99fc13cdfe743de4d08c740ebe636bf594cf6cd6-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/31555fcda6e0fb4a78efad786c66187fae667f6a-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/69e2c013cf748fc2c1fc66ca2b8b3d483d506018-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/62b1f68f7352f2591ea0b26463875c37fcf4d44c-1024x576.jpg'],
    scope:['Luxury guest rooms & hospitality facilities','Restaurant & bar block','Utility and service infrastructure','Internal road & site development'] },
  'hotel-allied-mahendra': { gallery:[], scope:['Hotel block with banquet & conference hall','Structural & finishing works','Site landscaping & utilities','Guest service infrastructure'] },
  'westin-pushkar': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/c546c947d1b77388e986e771a9c387a103888d15-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/6f27c2659941130dc4a446ebd46ea08c05fdd22e-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/0beed6799d218cb7f3a269847843750ce29fbad1-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/c6dcc9b708878b25482c55efc3a8b51b9e7a91eb-1024x576.jpg'],
    scope:['98 luxury guestrooms and villas','Private plunge pools with landscaped views','Wellness spa and leisure amenities','Civil and infrastructure execution across site'] },
  'hotel-paradise': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/735c52eeffd011ca83af2e01d399b5be829b676c-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/d14d19e0d9ede295bc2705b5cf3e7829cafa531e-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/2f5ced9cc8ae9aa77fc99644410e7904b5a9347b-1-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/10/13c0f6d1999acd1847a8eba9e8a55a083a2e02f7-1-1024x576.jpg'],
    scope:['Multi-storey hotel structure with modern façade','Guest rooms, banquet & service areas','Structural and MEP integration','Civil finishing & infrastructure delivery'] },
  'gold-palace': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/0206c68d51c4eb45d19a57427f83b7ec9ee55c20-1024x683.jpg'],
    scope:['68 guest rooms with heritage façade detailing','Banquet halls, restaurants, and spa facilities','Recreational zones and landscaped courtyards','Infrastructure development across 13 acres'] },
  'hotel-gajner': { gallery:[], scope:['Spa & wellness facility within heritage complex','Utility infrastructure & service areas','Kitchen block and maintenance works','Restoration aligned with conservation standards'] },
  'hotel-gaudavan': { gallery:['https://slmindia.in/wp-content/uploads/2025/10/0206c68d51c4eb45d19a57427f83b7ec9ee55c20-1024x683.jpg','https://slmindia.in/wp-content/uploads/2025/10/1a45eeab671f4ae0cdc7db6ded162f1ee183c835-1024x683.jpg','https://slmindia.in/wp-content/uploads/2025/10/65d524b1cb11bef6c7e7584bb9b6612792d893ea-1024x683.jpg','https://slmindia.in/wp-content/uploads/2025/10/93ac551a1f9f7b8302ff74fce8c747bde7089a1f-1024x683.jpg'],
    scope:['Complete civil & finishing works','Electrical & plumbing installations','Landscape & external development','Ready-to-operate handover'] },
  'gorbandh-palace': { gallery:[], scope:['Heritage-style architecture in sandstone','Luxury guest rooms and dining areas','Spa and recreational infrastructure','Civil works matching traditional detailing'] },

  // ── INSTITUTIONAL ──
  'hare-krishna': { gallery:['https://slmindia.in/wp-content/uploads/2025/09/9b01fbc120d6ab132271ee20ec6a03d384070dc5-1024x576.jpg'],
    scope:['17-storey temple & cultural center','25,000 sq.ft temple hall with grand Mayur Dwar','Convention & exhibition areas','Complete civil and infrastructure works'] },
  'jecrc-ncr': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/3b5352f9c7000c944f6c11e8a2d9e1c16b9df9ab-1024x576.png'],
    scope:['Structural repair & façade restoration','Civil & interior refurbishing works','Plumbing & electrical upgrades','Comprehensive campus redevelopment'] },
  'digambar-jain': { gallery:['https://slmindia.in/wp-content/uploads/2025/12/Component-94-1.png'],
    scope:['G+4 institutional & hostel buildings','Civil & interior development','Spiritual and residential facilities','Structural and finishing works'] },
  'vipra-foundation': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/ab2f633d62560eaaf2ca29a009b820b5ca3f7450-1024x771.jpg','https://slmindia.in/wp-content/uploads/2025/11/6054bccf64b39d13cc87ea324b7fc93a12971f7f-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/01fd6179a80e7eaa89cc1df4507498def6aa2532-1024x576.jpg'],
    scope:['Six-floor institutional complex','Classrooms & training centers','Research and skill development facilities','Structural & civil execution'] },
  'jnit-campus': { gallery:['https://slmindia.in/wp-content/uploads/2025/12/Component-94-2.png'],
    scope:['Academic & administrative blocks','Hostel & residential facilities','Internal roads and site infrastructure','Complete campus development'] },
  'jagannath-chaksu': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/29b2fac5998d7605770ab86dfa347e2565efff8a-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/19d07edc6ee840cd73977ca912ddaaad03e6c1a3-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/308c0fa9b190978f238b4f16a4643a7033ba37d1-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/24e4826606065c3357e14db76afed61a6cbbb67e-1024x576.jpg'],
    scope:['Academic and residential buildings','Infrastructure & utility networks','Administrative facilities','Complete campus planning & delivery'] },
  'gyan-vihar': { gallery:['https://slmindia.in/wp-content/uploads/2025/12/Component-95.png','https://slmindia.in/wp-content/uploads/2025/12/Component-96.png','https://slmindia.in/wp-content/uploads/2025/11/707b1f7e213d67ad0ed8b9a1f6e27a29dafd6f67-1024x576.jpg'],
    scope:['Twin 9-storey academic towers','Administrative & service blocks','Structural & civil works','Site infrastructure execution'] },
  'jaipur-dental': { gallery:[], scope:['Auditorium & classroom blocks','Hostel and student facilities','Civil & infrastructure works','Institutional-level finishing'] },

  // ── COMMERCIAL ──
  'akshat-nilay-c': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/e8e4c56229787f0dbbae746aef3d02d932f69b98-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/726110fe4b6cea1d0f2ca97fd06e04ae6712e218-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/cf547f4b4bbdea830ee89691d2dac914888a2a98-1024x576.jpg'],
    scope:['8-storey premium apartment building','62 well-planned residential units','Structural precision and modern elevation','Civil & infrastructure execution with quality assurance'] },
  'akshat-meadows-c': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/8a9c7f73933914fcc2aa2d09779fcf172b75da09-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/33146384867eb1f105634c2424219ab2e6c10bd5-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/cff215fe13838bc0c924bc91ff142cf462ba1402-1024x576.jpg'],
    scope:['Multi-storey premium residential structure','36 exclusive apartments','Reinforced concrete framework with modern finishes','Executed to high-end urban living standards'] },
  'akshat-meadows-2-c': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/83a10eabe748c11201ab6dfd3578cb2fc342c00b-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/640e002f741f1b20dd69871ccfdf81cf76c34772-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/0ff40f9cfacca498129b1407c637399edbab04c7-1024x576.jpg'],
    scope:['120 luxury villas & walk-up apartments','Retail center & tenement blocks','15,000 sq.ft clubhouse with gym, library & home theatre','Infrastructure including roads, STP, and electrical networks'] },

  // ── RESIDENTIAL ──
  'akshat-nilay-r': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/e8e4c56229787f0dbbae746aef3d02d932f69b98-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/726110fe4b6cea1d0f2ca97fd06e04ae6712e218-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/cf547f4b4bbdea830ee89691d2dac914888a2a98-1024x576.jpg'],
    scope:['8-storey premium apartment building','62 well-planned residential units','Structural precision and modern elevation','Civil & infrastructure execution with quality assurance'] },
  'akshat-meadows-r': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/8a9c7f73933914fcc2aa2d09779fcf172b75da09-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/33146384867eb1f105634c2424219ab2e6c10bd5-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/cff215fe13838bc0c924bc91ff142cf462ba1402-1024x576.jpg'],
    scope:['Multi-storey premium residential structure','36 exclusive apartments','Reinforced concrete framework with modern finishes','Executed to high-end urban living standards'] },
  'akshat-meadows-2-r': { gallery:['https://slmindia.in/wp-content/uploads/2025/11/83a10eabe748c11201ab6dfd3578cb2fc342c00b-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/640e002f741f1b20dd69871ccfdf81cf76c34772-1024x576.jpg','https://slmindia.in/wp-content/uploads/2025/11/0ff40f9cfacca498129b1407c637399edbab04c7-1024x576.jpg'],
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
        { '@type': 'ListItem', 'position': 2, 'name': 'Projects', 'item': location.origin + '/index.html#projects' },
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
        <img src="${p.img}" alt="${p.name}" class="proj-thumb-img" loading="lazy" />
      </div>
      <div style="padding:20px;background:#fff">
        <p style="font-size:10px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:#F47721;margin-bottom:6px">${p.category}</p>
        <h3 style="font-family:'Archivo Black',sans-serif;font-size:16px;font-weight:600;color:#111827;line-height:1.35;margin-bottom:5px">${p.name}</h3>
        <p style="color:#6B7280;font-size:13px;margin-bottom:5px">${p.location}</p>
        <p style="color:#111827;font-size:12px;font-weight:600">${p.area}</p>
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
    content.innerHTML = `<div style="padding:140px 24px;text-align:center"><h1 style="font-family:'Archivo Black',sans-serif;font-size:42px;font-weight:700;margin:0 0 16px">Project Not Found</h1><p style="color:#6B7280;margin-bottom:28px">The project you're looking for doesn't exist.</p><a href="index.html#projects" style="display:inline-flex;align-items:center;gap:8px;background:#F47721;color:#fff;padding:14px 28px;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:0.1em;text-transform:uppercase">Back to Projects</a></div>`;
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
  const allImgs = [p.img, ...(details.gallery || [])].filter(Boolean);
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
    <!-- Breadcrumb / Back strip -->
    <nav class="prj-crumb" aria-label="Breadcrumb">
      <a href="projects.html?category=${encodeURIComponent(p.category)}" class="prj-back">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Back to ${p.category}
      </a>
      <span class="prj-crumb-sep">/</span>
      <span class="prj-crumb-current">${p.name}</span>
    </nav>

    <!-- Hero -->
    <section class="prj-hero">
      <div class="prj-hero-img" style="background-image:url('${p.img}')" role="img" aria-label="${p.name}"></div>
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

    <!-- CTA (site-wide standard — matches journey / leadership) -->
    <section class="bg-dark py-20 lg:py-24 relative overflow-hidden" aria-label="Contact">
      <div class="absolute top-0 right-0 w-[40%] h-full opacity-5" style="background: radial-gradient(circle at right, #F47721, transparent 70%)"></div>
      <div class="relative max-w-3xl mx-auto px-6 lg:px-10 text-center">
        <p class="text-[11px] font-bold tracking-[0.32em] uppercase text-orange mb-5">Speak To Our Team</p>
        <h2 class="font-serif text-3xl lg:text-5xl font-semibold text-white leading-tight mb-5">
          Ready to build your<br/><span class="text-orange">next landmark</span>
        </h2>
        <p class="text-white/60 text-[15px] leading-relaxed max-w-xl mx-auto mb-9">
          Reach the partners directly for project-level discussions.
        </p>
        <a href="index.html#contact" data-magnetic
           class="inline-flex items-center gap-3 bg-orange text-white text-[12px] font-bold tracking-[0.1em] uppercase px-8 py-4 hover:bg-orange-dk transition-colors">
          Explore Now
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
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

/* ── Leader card 3D tilt on mouse move (runs on leadership.html) ── */
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
