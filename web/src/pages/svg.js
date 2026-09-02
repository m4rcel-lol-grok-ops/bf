function renderSvg(container) {
  container.innerHTML = `
    <div class="h-full flex flex-col gap-4">
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 class="text-2xl font-bold tracking-tight mb-1">SVG Editor</h1>
          <p class="text-muted text-sm">Draw, edit, and export vector graphics.</p>
        </div>
        
        <div class="flex items-center gap-3 bg-surface border border-border p-1.5 rounded-full">
          <div class="flex bg-bg rounded-full p-1" id="mode-toggle">
            <button class="px-4 py-1 text-sm font-medium rounded-full bg-surface shadow-sm" data-mode="visual">Visual</button>
            <button class="px-4 py-1 text-sm font-medium rounded-full text-muted hover:text-fg" data-mode="source">Source</button>
          </div>
          
          <div class="w-px h-5 bg-border"></div>

          <button id="download-svg" class="flex items-center gap-2 bg-primary text-primary-fg text-sm font-medium px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity">
            <i data-lucide="download" class="w-4 h-4"></i>
            <span>Export</span>
          </button>
        </div>
      </header>

      <div class="flex-1 flex gap-4 overflow-hidden relative">
        <!-- Toolbar -->
        <div id="svg-toolbar" class="w-14 bg-surface border border-border rounded-2xl flex flex-col items-center py-4 gap-2 shrink-0">
          <button class="tool-btn active p-2 rounded-xl text-fg bg-hover" data-tool="select" title="Select">
            <i data-lucide="mouse-pointer-2" class="w-5 h-5"></i>
          </button>
          <button class="tool-btn p-2 rounded-xl text-muted hover:text-fg hover:bg-hover" data-tool="rect" title="Rectangle">
            <i data-lucide="square" class="w-5 h-5"></i>
          </button>
          <button class="tool-btn p-2 rounded-xl text-muted hover:text-fg hover:bg-hover" data-tool="circle" title="Circle">
            <i data-lucide="circle" class="w-5 h-5"></i>
          </button>
          <div class="w-8 h-px bg-border my-2"></div>
          <button class="tool-btn p-2 rounded-xl text-muted hover:text-fg hover:bg-hover" data-tool="clear" title="Clear All">
            <i data-lucide="trash-2" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Canvas Area -->
        <div class="flex-1 bg-surface border border-border rounded-2xl relative overflow-hidden flex items-center justify-center bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiMzMzMiLz48L3N2Zz4=')]">
          <svg id="svg-canvas" class="w-[80%] h-[80%] bg-white shadow-xl rounded" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
            <!-- Initial content -->
            <rect x="100" y="100" width="200" height="150" fill="#f43f5e" rx="12" />
            <circle cx="500" cy="300" r="100" fill="#3b82f6" />
          </svg>
        </div>

        <!-- Source Area (Hidden initially) -->
        <div id="source-panel" class="absolute inset-0 bg-surface border border-border rounded-2xl flex hidden z-10">
          <textarea id="svg-source-textarea" class="w-full h-full bg-transparent text-fg p-6 outline-none resize-none font-mono text-sm leading-relaxed" spellcheck="false"></textarea>
        </div>
      </div>
    </div>
  `;
  const modeBtns = document.querySelectorAll("#mode-toggle button");
  const sourcePanel = document.getElementById("source-panel");
  const svgCanvas = document.getElementById("svg-canvas");
  const sourceTextarea = document.getElementById("svg-source-textarea");
  const toolbar = document.getElementById("svg-toolbar");
  modeBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = e.target;
      const mode = target.getAttribute("data-mode");
      modeBtns.forEach((b) => {
        b.classList.remove("bg-surface", "shadow-sm", "text-fg");
        b.classList.add("text-muted");
      });
      target.classList.add("bg-surface", "shadow-sm", "text-fg");
      target.classList.remove("text-muted");
      if (mode === "source") {
        sourcePanel?.classList.remove("hidden");
        toolbar?.classList.add("opacity-50", "pointer-events-none");
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svgCanvas);
        source = source.replace(/><\/rect>/g, " />").replace(/><\/circle>/g, " />");
        sourceTextarea.value = source;
      } else {
        sourcePanel?.classList.add("hidden");
        toolbar?.classList.remove("opacity-50", "pointer-events-none");
        if (sourceTextarea.value) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(sourceTextarea.value, "image/svg+xml");
          const newSvg = doc.querySelector("svg");
          if (newSvg) {
            svgCanvas.innerHTML = newSvg.innerHTML;
            if (newSvg.getAttribute("viewBox")) {
              svgCanvas.setAttribute("viewBox", newSvg.getAttribute("viewBox"));
            }
          }
        }
      }
    });
  });
  let activeTool = "select";
  const toolBtns = document.querySelectorAll(".tool-btn");
  toolBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const target = e.currentTarget;
      const tool = target.getAttribute("data-tool");
      if (tool === "clear") {
        svgCanvas.innerHTML = "";
        return;
      }
      toolBtns.forEach((b) => {
        b.classList.remove("active", "bg-hover", "text-fg");
        b.classList.add("text-muted");
      });
      target.classList.add("active", "bg-hover", "text-fg");
      target.classList.remove("text-muted");
      activeTool = tool || "select";
    });
  });
  let isDrawing = false;
  let currentElement = null;
  let startX = 0;
  let startY = 0;
  svgCanvas.addEventListener("mousedown", (e) => {
    if (activeTool === "select") return;
    isDrawing = true;
    const pt = svgCanvas.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgCanvas.getScreenCTM()?.inverse());
    startX = svgP.x;
    startY = svgP.y;
    if (activeTool === "rect") {
      currentElement = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      currentElement.setAttribute("x", startX.toString());
      currentElement.setAttribute("y", startY.toString());
      currentElement.setAttribute("width", "0");
      currentElement.setAttribute("height", "0");
      currentElement.setAttribute("fill", "transparent");
      currentElement.setAttribute("stroke", "currentColor");
      currentElement.setAttribute("stroke-width", "4");
      currentElement.setAttribute("rx", "8");
      svgCanvas.appendChild(currentElement);
    } else if (activeTool === "circle") {
      currentElement = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      currentElement.setAttribute("cx", startX.toString());
      currentElement.setAttribute("cy", startY.toString());
      currentElement.setAttribute("r", "0");
      currentElement.setAttribute("fill", "transparent");
      currentElement.setAttribute("stroke", "currentColor");
      currentElement.setAttribute("stroke-width", "4");
      svgCanvas.appendChild(currentElement);
    }
  });
  svgCanvas.addEventListener("mousemove", (e) => {
    if (!isDrawing || !currentElement) return;
    const pt = svgCanvas.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgCanvas.getScreenCTM()?.inverse());
    if (activeTool === "rect") {
      const w = Math.abs(svgP.x - startX);
      const h = Math.abs(svgP.y - startY);
      const x = Math.min(svgP.x, startX);
      const y = Math.min(svgP.y, startY);
      currentElement.setAttribute("x", x.toString());
      currentElement.setAttribute("y", y.toString());
      currentElement.setAttribute("width", w.toString());
      currentElement.setAttribute("height", h.toString());
    } else if (activeTool === "circle") {
      const r = Math.sqrt(Math.pow(svgP.x - startX, 2) + Math.pow(svgP.y - startY, 2));
      currentElement.setAttribute("r", r.toString());
    }
  });
  svgCanvas.addEventListener("mouseup", () => {
    isDrawing = false;
    currentElement = null;
  });
  document.getElementById("download-svg")?.addEventListener("click", () => {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgCanvas);
    const blob = new Blob([source], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "graphic.svg";
    a.click();
    URL.revokeObjectURL(url);
  });
}
export {
  renderSvg
};
