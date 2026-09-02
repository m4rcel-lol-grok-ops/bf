(function () {
  'use strict';

  const exprInput = document.getElementById('bb-expr');
  const playBtn = document.getElementById('bb-play');
  const stopBtn = document.getElementById('bb-stop');
  const volumeInput = document.getElementById('bb-volume');
  const rateSelect = document.getElementById('bb-rate');
  const durationInput = document.getElementById('bb-duration');
  const canvas = document.getElementById('bb-canvas');
  const presetSelect = document.getElementById('bb-presets');
  const saveBtn = document.getElementById('bb-save');
  const loadBtn = document.getElementById('bb-load');
  const exportBtn = document.getElementById('bb-export');
  const statusEl = document.getElementById('bb-status');

  if (!exprInput) return;

  const presets = {
    Classic: '(t*(t>>5|t>>8))>>(t>>16)',
    Bass: 't*(t>>9|t>>7)&128',
    Melody: '(t*5&t>>7)|(t*3&t>>10)',
    Noise: 't&t>>8',
    Experimental: '((t>>4)|(t>>8)|(t>>12))*t',
    Minimal: 't&128',
  };

  let audioCtx = null;
  let worker = null;
  let playing = false;
  let sourceNode = null;

  if (presetSelect) {
    Object.keys(presets).forEach((k) => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      presetSelect.appendChild(opt);
    });
    presetSelect.addEventListener('change', () => {
      if (presets[presetSelect.value]) {
        exprInput.value = presets[presetSelect.value];
      }
    });
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function getExpr() {
    return (exprInput.value || '').trim();
  }

  // Restricted evaluator via worker
  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker('/static/js/bytebeat-worker.js');
    return worker;
  }

  async function generateBuffer(expr, sampleRate, durationSec) {
    return new Promise((resolve, reject) => {
      const w = ensureWorker();
      const timeout = setTimeout(() => {
        reject(new Error('Generation timed out'));
      }, 10000);

      w.onmessage = (e) => {
        clearTimeout(timeout);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data.samples);
      };
      w.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
      w.postMessage({ expr, sampleRate, duration: durationSec });
    });
  }

  async function play() {
    const expr = getExpr();
    if (!expr) {
      setStatus('Enter an expression');
      return;
    }
    stop();
    setStatus('Generating…');

    const sampleRate = parseInt(rateSelect ? rateSelect.value : '8000', 10) || 8000;
    const duration = Math.min(Math.max(parseFloat(durationInput ? durationInput.value : '5') || 5, 0.5), 30);
    const volume = volumeInput ? parseFloat(volumeInput.value) : 0.3;

    try {
      const samples = await generateBuffer(expr, sampleRate, duration);
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = audioCtx.createBuffer(1, samples.length, sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        channel[i] = (samples[i] / 128 - 1) * volume;
      }

      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.connect(audioCtx.destination);
      sourceNode.onended = () => {
        playing = false;
        setStatus('Stopped');
      };
      sourceNode.start();
      playing = true;
      setStatus('Playing');
      drawWaveform(samples);
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  }

  function stop() {
    if (sourceNode) {
      try { sourceNode.stop(); } catch (_) {}
      sourceNode = null;
    }
    playing = false;
    setStatus('Stopped');
  }

  function drawWaveform(samples) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.clientWidth || 600;
    const h = canvas.height = 80;
    ctx.fillStyle = '#f4f4f5';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(samples.length / w));
    for (let x = 0; x < w; x++) {
      const idx = x * step;
      const v = samples[idx] / 255;
      const y = h - v * h;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function saveLocal() {
    const name = prompt('Composition name:', 'Untitled');
    if (!name) return;
    const data = {
      name,
      expression: getExpr(),
      sampleRate: rateSelect ? rateSelect.value : '8000',
      duration: durationInput ? durationInput.value : '5',
      volume: volumeInput ? volumeInput.value : '0.3',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    };
    const list = JSON.parse(localStorage.getItem('byteforge_bytebeat') || '[]');
    list.push(data);
    localStorage.setItem('byteforge_bytebeat', JSON.stringify(list));
    setStatus('Saved: ' + name);
  }

  function loadLocal() {
    const list = JSON.parse(localStorage.getItem('byteforge_bytebeat') || '[]');
    if (!list.length) {
      setStatus('No saved compositions');
      return;
    }
    const names = list.map((c, i) => (i + 1) + '. ' + c.name).join('\n');
    const choice = prompt('Load composition number:\n' + names);
    const idx = parseInt(choice, 10) - 1;
    if (idx >= 0 && idx < list.length) {
      const c = list[idx];
      exprInput.value = c.expression;
      if (rateSelect) rateSelect.value = c.sampleRate;
      if (durationInput) durationInput.value = c.duration;
      if (volumeInput) volumeInput.value = c.volume;
      setStatus('Loaded: ' + c.name);
    }
  }

  async function exportWav() {
    const expr = getExpr();
    if (!expr) return;
    setStatus('Exporting…');
    const sampleRate = parseInt(rateSelect ? rateSelect.value : '8000', 10) || 8000;
    const duration = Math.min(Math.max(parseFloat(durationInput ? durationInput.value : '5') || 5, 0.5), 30);
    try {
      const samples = await generateBuffer(expr, sampleRate, duration);
      const wav = encodeWav(samples, sampleRate);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bytebeat.wav';
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Exported WAV');
    } catch (err) {
      setStatus('Export error: ' + err.message);
    }
  }

  function encodeWav(samples, sampleRate) {
    const numSamples = samples.length;
    const buffer = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buffer);
    function writeStr(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples, true);
    for (let i = 0; i < numSamples; i++) {
      view.setUint8(44 + i, samples[i] & 0xff);
    }
    return buffer;
  }

  if (playBtn) playBtn.addEventListener('click', play);
  if (stopBtn) stopBtn.addEventListener('click', stop);
  if (saveBtn) saveBtn.addEventListener('click', saveLocal);
  if (loadBtn) loadBtn.addEventListener('click', loadLocal);
  if (exportBtn) exportBtn.addEventListener('click', exportWav);

  // Default preset
  if (!exprInput.value) exprInput.value = presets.Classic;
})();
