(function () {
  'use strict';

  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuToggle) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Highlight current nav
  const path = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.sidebar nav a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === path || (path === '/' && href === '/')) {
      a.classList.add('active');
    }
  });
})();
