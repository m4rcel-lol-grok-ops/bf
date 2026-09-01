(function () {
  'use strict';
  const form = document.getElementById('settings-form');
  if (!form) return;

  const keys = ['editor_fontsize', 'editor_wordwrap', 'bb_samplerate', 'rss_interval', 'theme'];

  // Load
  keys.forEach((k) => {
    const el = form.elements.namedItem(k) || document.getElementById('setting-' + k);
    if (el) {
      const val = localStorage.getItem('byteforge_' + k);
      if (val !== null) {
        if (el.type === 'checkbox') el.checked = val === 'true';
        else el.value = val;
      }
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    keys.forEach((k) => {
      const el = form.elements.namedItem(k) || document.getElementById('setting-' + k);
      if (el) {
        const val = el.type === 'checkbox' ? String(el.checked) : el.value;
        localStorage.setItem('byteforge_' + k, val);
      }
    });
    const status = document.getElementById('settings-status');
    if (status) {
      status.textContent = 'Saved';
      status.className = 'status success';
    }
  });
})();
