/* ═══════════════════════════════════════════════
   SHARED CHROME — injects nav + footer into any
   page that has <div id="nav-slot"></div> and
   <div id="footer-slot"></div>.

   Keeps nav/footer maintained in a single file
   across all separate pages (projects, project
   detail, journey, leadership).
═══════════════════════════════════════════════ */

(function () {
  'use strict';

  // Is the current page the home page (index.html)?
  // If so, anchor links stay as "#section". Otherwise prepend "index.html".
  function isHome() {
    const p = location.pathname.replace(/\/$/, '');
    return p === '' || p.endsWith('/index.html') || p.endsWith('/');
  }
  const HOME = isHome() ? '' : 'index.html';

  /* ── NAV ── */
  function renderNav(slot) {
    slot.outerHTML = `
<nav id="navbar" class="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
  <div class="max-w-screen-xl mx-auto px-6 lg:px-10 flex items-center justify-between h-18 py-4">

    <a href="${HOME || 'index.html'}" class="nav-logo-wrap flex items-center gap-3 flex-shrink-0">
      <span class="nav-logo-stack">
        <img class="nav-logo nav-logo-default"
             src="SLM Main logos/SLM White logo.png"
             alt="SLM" onerror="this.style.display='none'" />
        <img class="nav-logo nav-logo-scrolled"
             src="SLM Main logos/SLM gray logo.png"
             alt="SLM" onerror="this.style.display='none'" />
      </span>
    </a>

    <ul class="hidden lg:flex items-center gap-5 list-none">
      <li><a href="${HOME || 'index.html'}" class="nav-link text-[13px] font-medium text-white/85 hover:text-white transition-colors">Home</a></li>
      <li><a href="about.html"       class="nav-link text-[13px] font-medium text-white/85 hover:text-white transition-colors">About</a></li>
      <li><a href="${HOME}#services" class="nav-link text-[13px] font-medium text-white/85 hover:text-white transition-colors">Services</a></li>
      <li><a href="${HOME}#projects" class="nav-link text-[13px] font-medium text-white/85 hover:text-white transition-colors">Projects</a></li>
      <li><a href="tools.html"       class="nav-link text-[13px] font-medium text-white/85 hover:text-white transition-colors">Tools</a></li>
      <li><a href="journey.html"     class="nav-link text-[13px] font-medium text-white/85 hover:text-white transition-colors">Journey</a></li>
      <li><a href="leadership.html"  class="nav-link text-[13px] font-medium text-white/85 hover:text-white transition-colors">Leadership</a></li>
      <li><a href="${HOME}#contact"  class="nav-link text-[13px] font-medium text-white/85 hover:text-white transition-colors">Contact</a></li>
    </ul>

    <button id="themeToggle" class="theme-toggle inline-flex" aria-label="Toggle theme">
      <svg class="theme-icon-sun" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>
      <svg class="theme-icon-moon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z"/></svg>
    </button>

    <a href="${HOME}#contact" id="navCta" data-magnetic
      class="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 bg-orange text-white text-[13px] font-semibold tracking-wide hover:bg-orange-dk transition-colors">
      Get In Touch
      <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
    </a>

    <button id="menuBtn" class="lg:hidden p-2 text-white" aria-label="Menu">
      <svg id="iconBar"   width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      <svg id="iconClose" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="hidden"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  </div>

  <div id="mobileMenu" class="hidden lg:hidden bg-white border-t border-border shadow-xl max-h-[calc(100vh-72px)] overflow-y-auto">
    <div class="px-6 py-4 flex flex-col">
      <a href="${HOME || 'index.html'}" class="mm-link">Home</a>
      <a href="about.html"              class="mm-link">About</a>
      <a href="${HOME}#services"        class="mm-link">Services</a>

      <!-- Projects: expandable sub-menu -->
      <div class="mm-group">
        <button type="button" class="mm-group-toggle" aria-expanded="false">
          <span>Projects</span>
          <svg class="mm-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="mm-group-list">
          <a href="projects.html?category=Industrial"    class="mm-sublink">Industrial</a>
          <a href="projects.html?category=Hospitality"   class="mm-sublink">Hospitality</a>
          <a href="projects.html?category=Institutional" class="mm-sublink">Institutional</a>
          <a href="projects.html?category=Commercial"    class="mm-sublink">Commercial</a>
          <a href="projects.html?category=Residential"   class="mm-sublink">Residential</a>
          <a href="projects.html?category=Public%20Works" class="mm-sublink">Public Works</a>
        </div>
      </div>

      <a href="tools.html"       class="mm-link">Tools &amp; Machinery</a>
      <a href="journey.html"     class="mm-link">Journey</a>
      <a href="leadership.html"  class="mm-link">Leadership</a>
      <a href="${HOME}#contact"  class="mm-link mm-cta">Contact →</a>
    </div>
  </div>
</nav>`;
  }

  /* ── FOOTER ── */
  function renderFooter(slot) {
    slot.outerHTML = `
<footer id="contact" class="bg-dark text-white">

  <div class="max-w-screen-xl mx-auto px-6 lg:px-10 py-16 lg:py-20">
    <div class="grid lg:grid-cols-2 gap-16 xl:gap-24">

      <div>
        <div class="flex items-center mb-6">
          <img src="SLM Main logos/SLM White logo.png" alt="SLM" class="h-14 w-auto object-contain opacity-95" onerror="this.style.display='none'" />
        </div>

        <p class="text-white/50 text-[14px] leading-relaxed max-w-sm mb-8">
          M/S Sohan Lal Mathur, a third-generation family-owned construction company from Jaipur delivering engineering excellence since 1954.
        </p>

        <div class="space-y-4 mb-10">
          <div class="flex items-start gap-3">
            <svg class="w-4 h-4 text-orange flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
            <p class="text-white/55 text-[13px] leading-relaxed">B-3, Durga Path, Ambabari<br/>Jaipur, 302039, Rajasthan</p>
          </div>
          <div class="flex items-center gap-3">
            <svg class="w-4 h-4 text-orange flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498A1 1 0 0121 17v3a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
            <a href="tel:9509911871" class="text-white/55 text-[13px] hover:text-orange transition-colors">+91 9509911871</a>
          </div>
          <div class="flex items-center gap-3">
            <svg class="w-4 h-4 text-orange flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            <a href="mailto:sohanlalmathur@gmail.com" class="text-white/55 text-[13px] hover:text-orange transition-colors">sohanlalmathur@gmail.com</a>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-x-8 gap-y-2 border-t border-white/10 pt-8">
          <a href="${HOME || 'index.html'}"          class="text-white/45 text-[13px] hover:text-orange transition-colors py-1">Home</a>
          <a href="about.html"                       class="text-white/45 text-[13px] hover:text-orange transition-colors py-1">About</a>
          <a href="${HOME}#projects"                 class="text-white/45 text-[13px] hover:text-orange transition-colors py-1">Projects</a>
          <a href="journey.html"                     class="text-white/45 text-[13px] hover:text-orange transition-colors py-1">Journey</a>
          <a href="leadership.html"                  class="text-white/45 text-[13px] hover:text-orange transition-colors py-1">Leadership</a>
          <a href="tools.html"                       class="text-white/45 text-[13px] hover:text-orange transition-colors py-1">Tools &amp; Machinery</a>
          <a href="${HOME}#facts"                    class="text-white/45 text-[13px] hover:text-orange transition-colors py-1">Facts &amp; Figures</a>
          <a href="${HOME}#clients"                  class="text-white/45 text-[13px] hover:text-orange transition-colors py-1">Clients</a>
        </div>
      </div>

      <div>
        <h3 class="font-serif text-2xl font-semibold text-white mb-2">Send Us a Query</h3>
        <p class="text-white/45 text-[13px] mb-8">Fill in the form and we'll get back to you within 24 hours.</p>

        <form id="queryForm" class="flex flex-col gap-4">
          <div class="grid sm:grid-cols-2 gap-4">
            <div><label class="footer-label">Full Name *</label><input type="text" placeholder="Your name" class="footer-input" required /></div>
            <div><label class="footer-label">Phone Number</label><input type="tel" placeholder="+91 XXXXX XXXXX" class="footer-input" /></div>
          </div>
          <div><label class="footer-label">Email Address *</label><input type="email" placeholder="you@company.com" class="footer-input" required /></div>
          <div>
            <label class="footer-label">Project Type</label>
            <select class="footer-input footer-select">
              <option value="">Select a sector…</option>
              <option>Industrial</option><option>Commercial</option><option>Institutional</option>
              <option>Hospitality</option><option>Residential</option><option>Public Works</option><option>Other</option>
            </select>
          </div>
          <div><label class="footer-label">Message *</label><textarea placeholder="Tell us about your project, location and timeline…" class="footer-input footer-textarea" required></textarea></div>
          <button type="submit" class="footer-submit group" data-magnetic>
            Submit Query
            <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <div id="querySuccess" class="hidden text-center py-3 text-green-400 text-sm border border-green-400/30 bg-green-400/10">
            Thank you! We'll be in touch within 24 hours.
          </div>
        </form>
      </div>

    </div>
  </div>

  <div class="border-t border-white/8">
    <div class="max-w-screen-xl mx-auto px-6 lg:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
      <p class="text-white/30 text-xs">© 2025 M/S Sohan Lal Mathur. All Rights Reserved.</p>
      <p class="text-white/20 text-xs">Partners: Deepak &nbsp;·&nbsp; Kanhaiya Lal &nbsp;·&nbsp; Harsh Vardhan</p>
    </div>
  </div>
</footer>

<button id="backTop"
  class="fixed bottom-7 right-7 z-50 w-12 h-12 bg-orange text-white items-center justify-center hover:bg-orange-dk"
  aria-label="Back to top"
  onclick="window.scrollTo({top:0,behavior:'smooth'})">
  <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7"/></svg>
</button>`;
  }

  // Run immediately (before main.js queries these elements)
  const navSlot = document.getElementById('nav-slot');
  if (navSlot) renderNav(navSlot);
  const footerSlot = document.getElementById('footer-slot');
  if (footerSlot) renderFooter(footerSlot);

  // On sub-pages (anywhere chrome.js runs — index.html doesn't have nav-slot),
  // force the "scrolled" nav variant by default. The home-page nav starts
  // transparent and gets .scrolled on scroll; every other page stays solid.
  if (navSlot) {
    const nav = document.getElementById('navbar');
    if (nav) nav.classList.add('scrolled', 'is-subpage');
  }
})();
