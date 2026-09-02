function renderPdf(container) {
  container.innerHTML = `
    <div class="h-full flex flex-col gap-6">
      <header>
        <h1 class="text-3xl font-bold tracking-tight mb-2">PDF Viewer</h1>
        <p class="text-muted">Upload and view PDF documents securely in your browser.</p>
      </header>

      <div class="flex-1 bg-surface border border-border rounded-3xl p-2 relative flex flex-col overflow-hidden">
        
        <div id="pdf-drop-zone" class="absolute inset-2 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-muted hover:bg-hover transition-colors z-10 bg-surface">
          <input type="file" id="pdf-input" accept="application/pdf" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <div class="w-16 h-16 bg-bg rounded-full flex items-center justify-center mb-4 transition-transform">
            <i data-lucide="file-text" class="w-8 h-8 text-fg"></i>
          </div>
          <p class="text-lg font-medium mb-1">Select a PDF file</p>
          <p class="text-muted text-sm">Drag & drop or click to browse</p>
        </div>

        <div id="pdf-viewer-container" class="flex-1 w-full h-full hidden flex-col">
          <div class="flex items-center justify-between p-4 border-b border-border bg-surface shrink-0">
            <div class="flex items-center gap-3">
              <button id="close-pdf" class="p-2 hover:bg-hover rounded-xl text-muted hover:text-fg transition-colors" title="Close document">
                <i data-lucide="x" class="w-5 h-5"></i>
              </button>
              <span id="pdf-title" class="font-medium text-sm truncate max-w-[200px] sm:max-w-xs">Document.pdf</span>
            </div>
            <div class="flex items-center gap-2">
              <button class="p-2 hover:bg-hover rounded-xl text-muted hover:text-fg transition-colors" title="Zoom Out">
                <i data-lucide="zoom-out" class="w-5 h-5"></i>
              </button>
              <button class="p-2 hover:bg-hover rounded-xl text-muted hover:text-fg transition-colors" title="Zoom In">
                <i data-lucide="zoom-in" class="w-5 h-5"></i>
              </button>
            </div>
          </div>
          <div class="flex-1 bg-bg p-4 overflow-auto flex justify-center">
            <!-- Native embed as fallback, or canvas for PDF.js -->
            <embed id="pdf-embed" src="" type="application/pdf" class="w-full max-w-4xl h-full shadow-2xl rounded-xl bg-white" />
          </div>
        </div>

      </div>
    </div>
  `;
  const dropZone = document.getElementById("pdf-drop-zone");
  const fileInput = document.getElementById("pdf-input");
  const viewerContainer = document.getElementById("pdf-viewer-container");
  const embed = document.getElementById("pdf-embed");
  const closeBtn = document.getElementById("close-pdf");
  const pdfTitle = document.getElementById("pdf-title");
  let currentUrl = "";
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      if (file.type !== "application/pdf") {
        alert("Please select a valid PDF file.");
        return;
      }
      currentUrl = URL.createObjectURL(file);
      embed.src = currentUrl + "#toolbar=0";
      if (pdfTitle) pdfTitle.textContent = file.name;
      dropZone?.classList.add("hidden");
      viewerContainer?.classList.remove("hidden");
    }
  });
  closeBtn?.addEventListener("click", () => {
    embed.src = "";
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    viewerContainer?.classList.add("hidden");
    dropZone?.classList.remove("hidden");
    fileInput.value = "";
  });
}
export {
  renderPdf
};
