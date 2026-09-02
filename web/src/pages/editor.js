function renderEditor(container) {
  const savedSize = localStorage.getItem("byteforge-editor-size") || "16";
  container.innerHTML = `
    <div class="h-full flex flex-col gap-4">
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 class="text-2xl font-bold tracking-tight mb-1">Code Editor</h1>
          <p class="text-muted text-sm">A lightweight, persistent scratchpad.</p>
        </div>
        
        <div class="flex items-center gap-3 bg-surface border border-border p-1.5 rounded-full">
          <select id="lang-select" class="bg-transparent text-sm text-fg outline-none pl-3 pr-2 py-1 cursor-pointer">
            <option value="js">JavaScript</option>
            <option value="ts">TypeScript</option>
            <option value="python">Python</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="md">Markdown</option>
          </select>
          
          <div class="w-px h-5 bg-border"></div>
          
          <div class="flex items-center gap-1 px-2">
            <button id="font-dec" class="p-1 hover:bg-hover rounded text-muted hover:text-fg transition-colors" title="Decrease font size">
              <i data-lucide="minus" class="w-4 h-4"></i>
            </button>
            <span id="font-display" class="text-xs font-mono w-6 text-center">${savedSize}</span>
            <button id="font-inc" class="p-1 hover:bg-hover rounded text-muted hover:text-fg transition-colors" title="Increase font size">
              <i data-lucide="plus" class="w-4 h-4"></i>
            </button>
          </div>

          <div class="w-px h-5 bg-border"></div>

          <button id="download-code" class="flex items-center gap-2 bg-primary text-primary-fg text-sm font-medium px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity">
            <i data-lucide="download" class="w-4 h-4"></i>
            <span>Save</span>
          </button>
        </div>
      </header>

      <div class="flex-1 bg-surface border border-border rounded-2xl overflow-hidden relative">
        <!-- Line numbers could be added here, keeping it simple for now -->
        <textarea id="code-textarea" class="w-full h-full bg-transparent text-fg p-6 outline-none resize-none font-mono leading-relaxed" spellcheck="false" style="font-size: ${savedSize}px;"></textarea>
      </div>
    </div>
  `;
  const textarea = document.getElementById("code-textarea");
  const fontDec = document.getElementById("font-dec");
  const fontInc = document.getElementById("font-inc");
  const fontDisplay = document.getElementById("font-display");
  const downloadBtn = document.getElementById("download-code");
  const langSelect = document.getElementById("lang-select");
  let currentSize = parseInt(savedSize, 10);
  const updateFontSize = (newSize) => {
    if (newSize < 10 || newSize > 32) return;
    currentSize = newSize;
    textarea.style.fontSize = `${currentSize}px`;
    if (fontDisplay) fontDisplay.textContent = currentSize.toString();
    localStorage.setItem("byteforge-editor-size", currentSize.toString());
  };
  fontDec?.addEventListener("click", () => updateFontSize(currentSize - 1));
  fontInc?.addEventListener("click", () => updateFontSize(currentSize + 1));
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      textarea.value = val.substring(0, start) + "  " + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
    }
  });
  downloadBtn?.addEventListener("click", () => {
    const text = textarea.value;
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snippet.${langSelect.value}`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
export {
  renderEditor
};
