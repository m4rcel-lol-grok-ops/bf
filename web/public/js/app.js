(function () {
  'use strict';

  const EXIT_MS = 300;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Gentle enter on load (skipped if reduced motion)
  if (!prefersReducedMotion()) {
    document.documentElement.classList.add('page-ready');
  }

  function navigateSmooth(href) {
    if (prefersReducedMotion()) {
      window.location.href = href;
      return;
    }
    document.documentElement.classList.remove('page-ready');
    document.documentElement.classList.add('page-exit');
    setTimeout(function () {
      window.location.href = href;
    }, EXIT_MS);
  }

  document.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) return;
    if (href.startsWith('http://') || href.startsWith('https://')) return;
    if (href.startsWith('/') || !href.includes('://')) {
      e.preventDefault();
      const target = href.startsWith('/') ? href : '/' + href;
      if (target === location.pathname || target === location.pathname + '/') return;
      navigateSmooth(href);
    }
  });

  window.byteforgeNavigate = navigateSmooth;

  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', function (e) {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuToggle) {
        sidebar.classList.remove('open');
      }
    });
  }

  const path = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.sidebar nav a, .sidebar-footer a').forEach(function (a) {
    const href = a.getAttribute('href');
    if (href === path || (path === '/' && href === '/')) {
      a.classList.add('active');
    } else {
      a.classList.remove('active');
    }
  });
})();
