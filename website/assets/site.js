/* SPARKXHR site behaviour: icons, menu, reveal animations, tabs, contact form. */
(function () {
  'use strict';
  window.__sparkReady = true;
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (window.lucide) window.lucide.createIcons();

  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  // ---- Mobile menu ----
  var toggle = document.querySelector('[data-nav-toggle]');
  var panel = document.getElementById('mobile-nav');
  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      var opening = panel.hidden;
      panel.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
      toggle.setAttribute('aria-label', opening ? 'Close menu' : 'Open menu');
      toggle.querySelector('[data-icon-open]').hidden = opening;
      toggle.querySelector('[data-icon-close]').hidden = !opening;
    });
  }

  // ---- Tabs ----
  document.querySelectorAll('[data-tabs]').forEach(function (wrap) {
    var tabs = Array.prototype.slice.call(wrap.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(wrap.querySelectorAll('[role="tabpanel"]'));
    function select(i, focus) {
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; });
      panels.forEach(function (p, j) { p.hidden = i !== j; });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
    select(0);
  });

  // ---- Contact form (preview mode until an endpoint is configured) ----
  var form = document.querySelector('[data-contact-form]');
  if (form && form.hasAttribute('data-preview')) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var note = form.querySelector('[data-form-note]');
      if (note) { note.hidden = false; note.focus(); }
    });
  }

  // ---- Reveal animations ----
  if (reduce || !('IntersectionObserver' in window)) { root.classList.add('no-anim'); return; }

  function splitWords(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span'); w.className = 'w';
            var inner = document.createElement('span'); inner.className = 'wi';
            inner.style.setProperty('--i', String(i++));
            inner.textContent = part;
            w.appendChild(inner); frag.appendChild(w);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR' && !child.classList.contains('w')) {
          walk(child);
        }
      });
    })(el);
  }
  document.querySelectorAll('[data-split]').forEach(splitWords);

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      el.classList.add('is-in');
      io.unobserve(el);
      if (el.hasAttribute('data-reveal')) {
        var d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
        // Hand the element back to its own hover transitions once it has arrived.
        setTimeout(function () { el.removeAttribute('data-reveal'); el.classList.remove('is-in'); }, d + 1000);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('[data-reveal], [data-split]').forEach(function (el) { io.observe(el); });
})();
