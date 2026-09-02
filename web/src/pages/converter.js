function mimeForTarget(target) {
  const map = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    html: "text/html",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return map[String(target).toLowerCase()] || target;
}

function renderConverter(container) {
  container.innerHTML = `
    <div class="max-w-3xl mx-auto flex flex-col gap-6">
      <header>
        <h1 class="text-3xl font-bold tracking-tight mb-2">File Converter</h1>
        <p class="text-muted">Convert images, audio, video and text formats.</p>
      </header>

      <div class="bg-surface border border-border rounded-3xl p-8">
        <form id="convert-form" class="flex flex-col gap-6">
          <div id="drop-zone" class="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-muted hover:bg-hover transition-colors relative group">
            <input type="file" id="file-input" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div class="w-16 h-16 bg-bg rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <i data-lucide="upload-cloud" class="w-8 h-8 text-fg"></i>
            </div>
            <p class="text-lg font-medium mb-1">Drag and drop your file here</p>
            <p class="text-muted text-sm" id="file-name">or click to browse from your computer</p>
          </div>

          <div class="flex flex-col sm:flex-row gap-4 items-center">
            <div class="flex-1 w-full">
              <label class="block text-sm font-medium text-muted mb-2">Target Format</label>
              <select id="format-select" class="w-full bg-bg border border-border rounded-xl px-4 py-3 text-fg outline-none focus:border-primary disabled:opacity-50">
                <option value="">Select format...</option>
                <optgroup label="Images">
                  <option value="png">PNG</option>
                  <option value="jpg">JPEG</option>
                  <option value="webp">WebP</option>
                  <option value="gif">GIF</option>
                  <option value="bmp">BMP</option>
                </optgroup>
                <optgroup label="Documents">
                  <option value="txt">Text</option>
                  <option value="md">Markdown</option>
                  <option value="html">HTML</option>
                </optgroup>
                <optgroup label="Audio">
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                </optgroup>
                <optgroup label="Video">
                  <option value="mp4">MP4</option>
                  <option value="webm">WebM</option>
                </optgroup>
              </select>
            </div>
            <button type="submit" id="convert-btn" class="mt-7 w-full sm:w-auto bg-primary text-primary-fg font-semibold px-8 py-3 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" disabled>
              Convert
            </button>
          </div>
        </form>

        <div id="progress-wrap" class="hidden mt-6">
          <div class="flex justify-between text-sm text-muted mb-2">
            <span id="status-text">Uploading...</span>
            <span id="progress-pct">0%</span>
          </div>
          <div class="h-1.5 bg-border rounded-full overflow-hidden">
            <div id="progress-bar" class="h-full bg-primary rounded-full transition-all duration-300" style="width:0%"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const fileInput = document.getElementById("file-input");
  const fileName = document.getElementById("file-name");
  const formatSelect = document.getElementById("format-select");
  const convertBtn = document.getElementById("convert-btn");
  const convertForm = document.getElementById("convert-form");
  const progressWrap = document.getElementById("progress-wrap");
  const progressBar = document.getElementById("progress-bar");
  const progressPct = document.getElementById("progress-pct");
  const statusText = document.getElementById("status-text");
  let selectedFile = null;

  const checkValidity = () => {
    convertBtn.disabled = !(selectedFile && formatSelect.value);
  };

  fileInput.addEventListener("change", () => {
    selectedFile = fileInput.files?.[0] || null;
    fileName.textContent = selectedFile ? selectedFile.name : "or click to browse from your computer";
    checkValidity();
  });
  formatSelect.addEventListener("change", checkValidity);

  convertForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedFile || !formatSelect.value) return;

    convertBtn.disabled = true;
    formatSelect.disabled = true;
    progressWrap.classList.remove("hidden");
    statusText.textContent = "Uploading...";
    progressBar.style.width = "15%";
    progressPct.textContent = "15%";

    const form = new FormData();
    form.append("file", selectedFile);
    form.append("target", mimeForTarget(formatSelect.value));

    try {
      const res = await fetch("/api/converter/upload", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || res.statusText);
      }
      const data = await res.json();
      statusText.textContent = "Processing...";
      progressBar.style.width = "45%";
      progressPct.textContent = "45%";

      const jobId = data.job_id;
      const poll = async () => {
        const jr = await fetch("/api/converter/job/" + jobId);
        if (!jr.ok) throw new Error("Job not found");
        const job = await jr.json();
        const p = Math.max(45, Math.min(95, Math.round(job.progress || 50)));
        progressBar.style.width = p + "%";
        progressPct.textContent = p + "%";
        if (job.status === "completed") {
          progressBar.style.width = "100%";
          progressPct.textContent = "100%";
          statusText.textContent = "Done";
          if (job.result_id) {
            window.location.href = "/download/" + job.result_id;
          }
          convertBtn.disabled = false;
          formatSelect.disabled = false;
          return;
        }
        if (job.status === "failed") {
          throw new Error(job.error || "Conversion failed");
        }
        setTimeout(poll, 800);
      };
      await poll();
    } catch (err) {
      statusText.textContent = err.message || "Conversion failed";
      progressBar.style.width = "0%";
      progressPct.textContent = "0%";
      convertBtn.disabled = false;
      formatSelect.disabled = false;
    }
  });
}

export { renderConverter };
