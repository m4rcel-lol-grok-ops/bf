(function () {
  'use strict';

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const targetSelect = document.getElementById('target-format');
  const statusEl = document.getElementById('status');
  const progressEl = document.getElementById('progress-bar');
  const progressWrap = document.getElementById('progress');

  if (!dropzone) return;

  const formats = {
    'image/png': ['image/jpeg', 'image/webp', 'image/gif', 'image/bmp'],
    'image/jpeg': ['image/png', 'image/webp', 'image/gif', 'image/bmp'],
    'image/webp': ['image/png', 'image/jpeg', 'image/gif'],
    'image/gif': ['image/png', 'image/jpeg', 'image/webp'],
    'image/bmp': ['image/png', 'image/jpeg', 'image/webp'],
    'image/tiff': ['image/png', 'image/jpeg', 'image/webp'],
    'image/svg+xml': ['image/png'],
    'text/plain': ['text/html', 'text/markdown'],
    'text/markdown': ['text/html', 'text/plain'],
    'text/html': ['text/plain', 'text/markdown'],
    'audio/mpeg': ['audio/wav'],
    'audio/wav': ['audio/mpeg'],
    'video/mp4': ['video/webm'],
    'video/webm': ['video/mp4'],
  };

  function setStatus(msg, type) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  function populateTargets(mime) {
    if (!targetSelect) return;
    targetSelect.innerHTML = '';
    const targets = formats[mime] || [];
    if (targets.length === 0) {
      targetSelect.innerHTML = '<option value="">No conversions available</option>';
      return;
    }
    targets.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      targetSelect.appendChild(opt);
    });
  }

  dropzone.addEventListener('click', () => fileInput && fileInput.click());
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) handleFile(fileInput.files[0]);
    });
  }

  async function handleFile(file) {
    populateTargets(file.type || guessMime(file.name));
    setStatus('Uploading…');
    if (progressWrap) progressWrap.classList.remove('hidden');
    if (progressEl) progressEl.style.width = '10%';

    const form = new FormData();
    form.append('file', file);
    form.append('target', targetSelect ? targetSelect.value : 'image/png');

    try {
      const res = await fetch('/api/converter/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data = await res.json();
      pollJob(data.job_id);
    } catch (err) {
      setStatus(err.message || 'Upload failed', 'error');
      if (progressWrap) progressWrap.classList.add('hidden');
    }
  }

  async function pollJob(id) {
    setStatus('Processing…');
    if (progressEl) progressEl.style.width = '40%';
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/converter/job/' + id);
        if (!res.ok) throw new Error('Job not found');
        const job = await res.json();
        if (progressEl) progressEl.style.width = (job.progress || 50) + '%';
        if (job.status === 'completed') {
          clearInterval(interval);
          if (progressEl) progressEl.style.width = '100%';
          setStatus('Done — downloading…', 'success');
          if (job.result_id) {
            window.location.href = '/download/' + job.result_id;
          }
        } else if (job.status === 'failed') {
          clearInterval(interval);
          setStatus(job.error || 'Conversion failed', 'error');
        }
      } catch (err) {
        clearInterval(interval);
        setStatus(err.message, 'error');
      }
    }, 800);
  }

  function guessMime(name) {
    const ext = name.split('.').pop().toLowerCase();
    const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm', txt: 'text/plain', md: 'text/markdown', html: 'text/html' };
    return map[ext] || 'application/octet-stream';
  }
})();
