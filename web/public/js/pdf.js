(function () {
  'use strict';
  const dropzone = document.getElementById('pdf-dropzone');
  const fileInput = document.getElementById('pdf-file');
  const statusEl = document.getElementById('pdf-status');
  const viewer = document.getElementById('pdf-viewer');

  if (!dropzone) return;

  function setStatus(msg, type) {
    if (statusEl) {
      statusEl.textContent = msg;
      statusEl.className = 'status' + (type ? ' ' + type : '');
    }
  }

  dropzone.addEventListener('click', () => fileInput && fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handle(e.dataTransfer.files[0]);
  });
  if (fileInput) fileInput.addEventListener('change', () => { if (fileInput.files[0]) handle(fileInput.files[0]); });

  async function handle(file) {
    if (file.type !== 'application/pdf') {
      setStatus('Please upload a PDF file', 'error');
      return;
    }
    setStatus('Uploading…');
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/pdf/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setStatus('PDF loaded (job ' + data.job_id + '). Use PDF.js for full viewing in production.', 'success');
      // Embed via object for basic viewing
      if (viewer) {
        const url = URL.createObjectURL(file);
        viewer.innerHTML = '<object data="' + url + '" type="application/pdf" width="100%" height="600"></object>';
      }
    } catch (err) {
      setStatus(err.message, 'error');
    }
  }
})();
