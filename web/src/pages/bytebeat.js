const PRESETS = {
  Classic: "(t*(t>>5|t>>8))>>(t>>16)",
  Bass: "t*(t>>9|t>>7)&128",
  Melody: "(t*5&t>>7)|(t*3&t>>10)",
  Noise: "t&t>>8",
  Experimental: "((t>>4)|(t>>8)|(t>>12))*t",
  Minimal: "t&128",
};

function renderBytebeat(container) {
  container.innerHTML = `
    <div class="max-w-3xl mx-auto flex flex-col gap-6">
      <header>
        <h1 class="text-3xl font-bold tracking-tight mb-2">Bytebeat Composer</h1>
        <p class="text-muted">Write mathematical audio expressions and play them live.</p>
      </header>

      <div class="bg-surface border border-border rounded-3xl p-6 flex flex-col gap-5">
        <div>
          <label class="block text-sm text-muted mb-2">Expression</label>
          <textarea id="bb-expr" rows="3"
            class="w-full bg-bg border border-border rounded-2xl px-4 py-3 font-mono text-sm text-fg outline-none focus:border-border-hover resize-y">${PRESETS.Classic}</textarea>
        </div>

        <div class="flex flex-wrap gap-2">
          <button id="bb-play" class="bg-primary text-primary-fg font-semibold px-5 py-2.5 rounded-full hover:opacity-90">Play</button>
          <button id="bb-stop" class="bg-surface-alt border border-border px-5 py-2.5 rounded-full hover:bg-hover">Stop</button>
          <button id="bb-export" class="bg-surface-alt border border-border px-5 py-2.5 rounded-full hover:bg-hover">Export WAV</button>
          <button id="bb-save" class="bg-surface-alt border border-border px-5 py-2.5 rounded-full hover:bg-hover">Save</button>
          <button id="bb-load" class="bg-surface-alt border border-border px-5 py-2.5 rounded-full hover:bg-hover">Load</button>
        </div>

        <div class="flex flex-wrap gap-4 items-center text-sm">
          <label class="flex items-center gap-2 text-muted">
            Preset
            <select id="bb-presets" class="bg-bg border border-border rounded-full px-3 py-1.5 text-fg outline-none">
              ${Object.keys(PRESETS).map((k) => `<option value="${k}">${k}</option>`).join("")}
            </select>
          </label>
          <label class="flex items-center gap-2 text-muted">
            Rate
            <select id="bb-rate" class="bg-bg border border-border rounded-full px-3 py-1.5 text-fg outline-none">
              <option value="8000">8000</option>
              <option value="11025">11025</option>
              <option value="16000">16000</option>
              <option value="22050">22050</option>
              <option value="44100">44100</option>
              <option value="48000">48000</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-muted">
            Duration
            <input type="number" id="bb-duration" value="5" min="0.5" max="30" step="0.5"
              class="w-16 bg-bg border border-border rounded-full px-3 py-1.5 text-fg outline-none" />
          </label>
          <label class="flex items-center gap-2 text-muted">
            Volume
            <input type="range" id="bb-volume" min="0" max="1" step="0.05" value="0.3" class="w-28" />
          </label>
        </div>

        <canvas id="bb-canvas" class="w-full h-20 rounded-2xl bg-bg border border-border"></canvas>
        <p id="bb-status" class="text-sm text-muted"></p>
      </div>
    </div>
  `;

  const exprInput = document.getElementById("bb-expr");
  const statusEl = document.getElementById("bb-status");
  const canvas = document.getElementById("bb-canvas");
  const rateSelect = document.getElementById("bb-rate");
  const durationInput = document.getElementById("bb-duration");
  const volumeInput = document.getElementById("bb-volume");
  const presetSelect = document.getElementById("bb-presets");

  let audioCtx = null;
  let worker = null;
  let sourceNode = null;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker("/src/pages/bytebeat-worker.js");
    return worker;
  }

  function generateBuffer(expr, sampleRate, durationSec) {
    return new Promise((resolve, reject) => {
      const w = ensureWorker();
      const timeout = setTimeout(() => reject(new Error("Generation timed out")), 12000);
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

  function drawWaveform(samples) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = (canvas.width = canvas.clientWidth || 600);
    const h = (canvas.height = 80);
    const styles = getComputedStyle(document.documentElement);
    ctx.fillStyle = styles.getPropertyValue("--bg").trim() || "#050505";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = styles.getPropertyValue("--fg").trim() || "#e5e5e5";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(samples.length / w));
    for (let x = 0; x < w; x++) {
      const v = samples[x * step] / 255;
      const y = h - v * h;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function stop() {
    if (sourceNode) {
      try { sourceNode.stop(); } catch (_) {}
      sourceNode = null;
    }
    setStatus("Stopped");
  }

  async function play() {
    const expr = (exprInput?.value || "").trim();
    if (!expr) {
      setStatus("Enter an expression");
      return;
    }
    stop();
    setStatus("Generating…");
    const sampleRate = parseInt(rateSelect?.value || "8000", 10) || 8000;
    const duration = Math.min(Math.max(parseFloat(durationInput?.value || "5") || 5, 0.5), 30);
    const volume = parseFloat(volumeInput?.value || "0.3");
    try {
      const samples = await generateBuffer(expr, sampleRate, duration);
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") await audioCtx.resume();
      const buffer = audioCtx.createBuffer(1, samples.length, sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        channel[i] = (samples[i] / 128 - 1) * volume;
      }
      sourceNode = audioCtx.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.connect(audioCtx.destination);
      sourceNode.onended = () => setStatus("Stopped");
      sourceNode.start();
      setStatus("Playing");
      drawWaveform(samples);
    } catch (err) {
      setStatus("Error: " + (err.message || err));
    }
  }

  function encodeWav(samples, sampleRate) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n);
    const view = new DataView(buf);
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + n, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeStr(36, "data");
    view.setUint32(40, n, true);
    for (let i = 0; i < n; i++) view.setUint8(44 + i, samples[i] & 0xff);
    return buf;
  }

  async function exportWav() {
    const expr = (exprInput?.value || "").trim();
    if (!expr) return;
    setStatus("Exporting…");
    const sampleRate = parseInt(rateSelect?.value || "8000", 10) || 8000;
    const duration = Math.min(Math.max(parseFloat(durationInput?.value || "5") || 5, 0.5), 30);
    try {
      const samples = await generateBuffer(expr, sampleRate, duration);
      const wav = encodeWav(samples, sampleRate);
      const blob = new Blob([wav], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bytebeat.wav";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Exported WAV");
    } catch (err) {
      setStatus("Export error: " + (err.message || err));
    }
  }

  function saveLocal() {
    const name = prompt("Composition name:", "Untitled");
    if (!name) return;
    const list = JSON.parse(localStorage.getItem("byteforge_bytebeat") || "[]");
    list.push({
      name,
      expression: exprInput.value,
      sampleRate: rateSelect.value,
      duration: durationInput.value,
      volume: volumeInput.value,
      modified: new Date().toISOString(),
    });
    localStorage.setItem("byteforge_bytebeat", JSON.stringify(list));
    setStatus("Saved: " + name);
  }

  function loadLocal() {
    const list = JSON.parse(localStorage.getItem("byteforge_bytebeat") || "[]");
    if (!list.length) {
      setStatus("No saved compositions");
      return;
    }
    const names = list.map((c, i) => (i + 1) + ". " + c.name).join("\n");
    const choice = prompt("Load composition number:\n" + names);
    const idx = parseInt(choice, 10) - 1;
    if (idx >= 0 && idx < list.length) {
      const c = list[idx];
      exprInput.value = c.expression;
      if (rateSelect) rateSelect.value = c.sampleRate;
      if (durationInput) durationInput.value = c.duration;
      if (volumeInput) volumeInput.value = c.volume;
      setStatus("Loaded: " + c.name);
    }
  }

  presetSelect?.addEventListener("change", () => {
    if (PRESETS[presetSelect.value]) exprInput.value = PRESETS[presetSelect.value];
  });
  document.getElementById("bb-play")?.addEventListener("click", play);
  document.getElementById("bb-stop")?.addEventListener("click", stop);
  document.getElementById("bb-export")?.addEventListener("click", exportWav);
  document.getElementById("bb-save")?.addEventListener("click", saveLocal);
  document.getElementById("bb-load")?.addEventListener("click", loadLocal);
}

export { renderBytebeat };
