function renderPdf(container) {
  container.innerHTML = `
    <div class="max-w-4xl mx-auto flex flex-col gap-6" style="min-height: calc(100vh - 3rem);">
      <header>
        <h1 class="text-3xl font-bold tracking-tight mb-2">PDF Editor</h1>
        <p class="text-muted">Upload and view PDF documents in the browser.</p>
      </header>

      <div id="pdf-drop-zone" class="bg-surface border border-border rounded-3xl p-10 border-dashed cursor-pointer hover:bg-hover transition-colors">
        <div class="flex flex-col items-center text-center gap-3 relative">
          <input type="file" id="pdf-input" accept="application/pdf" class="absolute inset-0 opacity-0 cursor-pointer" />
          <div class="w-16 h-16 rounded-full bg-bg border border-border flex items-center justify-center">
            <i data-lucide="file-text" class="w-8 h-8 text-fg"></i>
          </div>
          <p class="text-lg font-medium">Drop a PDF here or click to select</p>
          <p class="text-sm text-muted">PDF files only</p>
        </div>
      </div>
      <p id="pdf-status" class="text-sm text-muted"></p>

      <div id="pdf-viewer-container" class="hidden flex flex-col bg-surface border border-border rounded-3xl overflow-hidden" style="min-height: 32rem;">
        <div class="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <button type="button" id="close-pdf" class="p-2 hover:bg-hover rounded-xl text-muted hover:text-fg" title="Close">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
            <span id="pdf-title" class="font-medium text-sm truncate">Document.pdf</span>
          </div>
        </div>
        <div class="flex-1 bg-bg p-4 overflow-auto" style="min-height: 28rem;">
          <iframe id="pdf-frame" title="PDF preview" class="w-full rounded-xl bg-white border border-border" style="min-height: 28rem; height: 70vh;"></iframe>
        </div>
      </div>
    </div>
  `;

  const dropZone = document.getElementById("pdf-drop-zone");
  const fileInput = document.getElementById("pdf-input");
  const viewer = document.getElementById("pdf-viewer-container");
  const frame = document.getElementById("pdf-frame");
  const statusEl = document.getElementById("pdf-status");
  const pdfTitle = document.getElementById("pdf-title");
  let currentUrl = "";

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || "";
  }

  async function openFile(file) {
    if (!file || file.type !== "application/pdf") {
      setStatus("Please select a valid PDF file.");
      return;
    }
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(file);
    if (frame) frame.src = currentUrl;
    if (pdfTitle) pdfTitle.textContent = file.name;
    dropZone?.classList.add("hidden");
    viewer?.classList.remove("hidden");
    setStatus("Loaded: " + file.name);

    // Optional: notify backend
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/pdf/upload", { method: "POST", body: form });
      if (res.ok) {
        const data = await res.json();
        setStatus("Loaded: " + file.name + (data.job_id ? " (job " + data.job_id + ")" : ""));
      }
    } catch (_) {
      // local preview still works offline
    }
  }

  fileInput?.addEventListener("change", () => {
    if (fileInput.files?.[0]) openFile(fileInput.files[0]);
  });

  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("bg-hover");
  });
  dropZone?.addEventListener("dragleave", () => dropZone.classList.remove("bg-hover"));
  dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("bg-hover");
    if (e.dataTransfer?.files?.[0]) openFile(e.dataTransfer.files[0]);
  });

  document.getElementById("close-pdf")?.addEventListener("click", () => {
    if (frame) frame.src = "";
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = "";
    viewer?.classList.add("hidden");
    dropZone?.classList.remove("hidden");
    if (fileInput) fileInput.value = "";
    setStatus("");
  });
}

export { renderPdf };
