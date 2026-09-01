(function () {
  'use strict';

  const commands = [
    { name: 'Open Converter', path: '/converter', keys: 'c' },
    { name: 'Open Code Editor', path: '/editor', keys: 'e' },
    { name: 'Open SVG Editor', path: '/svg', keys: 's' },
    { name: 'Open PDF Editor', path: '/pdf', keys: 'p' },
    { name: 'Open RSS Reader', path: '/rss', keys: 'r' },
    { name: 'Open Bytebeat', path: '/bytebeat', keys: 'b' },
    { name: 'Open Settings', path: '/settings', keys: ',' },
    { name: 'Dashboard', path: '/', keys: 'd' },
  ];

  const palette = document.getElementById('command-palette');
  const input = document.getElementById('cmd-input');
  const list = document.getElementById('cmd-list');
  const btn = document.getElementById('cmd-btn');

  if (!palette || !input || !list) return;

  let activeIdx = 0;
  let filtered = commands;

  function open() {
    palette.classList.remove('hidden');
    input.value = '';
    filter('');
    input.focus();
  }

  function close() {
    palette.classList.add('hidden');
  }

  function filter(q) {
    const lower = q.toLowerCase();
    filtered = commands.filter((c) => c.name.toLowerCase().includes(lower));
    activeIdx = 0;
    render();
  }

  function render() {
    list.innerHTML = '';
    filtered.forEach((c, i) => {
      const li = document.createElement('li');
      li.textContent = c.name;
      if (i === activeIdx) li.classList.add('active');
      li.addEventListener('click', () => {
        location.href = c.path;
      });
      list.appendChild(li);
    });
  }

  function go() {
    if (filtered[activeIdx]) {
      location.href = filtered[activeIdx].path;
    }
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (palette.classList.contains('hidden')) open();
      else close();
    }
    if (!palette.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, filtered.length - 1);
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        render();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        go();
      }
    }
  });

  input.addEventListener('input', () => filter(input.value));
  if (btn) btn.addEventListener('click', open);

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!palette.classList.contains('hidden') && !palette.contains(e.target) && e.target !== btn) {
      close();
    }
  });
})();
