function renderSvg(container) {
  container.innerHTML = `
    <div class="flex flex-col gap-4" style="min-height: calc(100vh - 3rem);">
      <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 class="text-2xl font-bold tracking-tight mb-1">SVG Editor</h1>
          <p class="text-muted text-sm">Draw, edit, and export vector graphics.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex bg-surface border border-border rounded-full p-1" id="mode-toggle">
            <button type="button" class="mode-btn px-4 py-1.5 text-sm font-medium rounded-full bg-primary text-primary-fg" data-mode="visual">Visual</button>
            <button type="button" class="mode-btn px-4 py-1.5 text-sm font-medium rounded-full text-muted hover:text-fg" data-mode="source">Source</button>
          </div>
          <button type="button" id="import-svg" class="px-4 py-2 text-sm rounded-full border border-border bg-surface hover:bg-hover">Import</button>
          <input type="file" id="svg-file" accept=".svg,image/svg+xml" class="hidden" />
          <button type="button" id="download-svg" class="flex items-center gap-2 bg-primary text-primary-fg text-sm font-medium px-4 py-2 rounded-full hover:opacity-90">
            <i data-lucide="download" class="w-4 h-4"></i>
            Export
          </button>
        </div>
      </header>

      <div class="flex flex-1 gap-4 min-h-0" style="min-height: 28rem;">
        <div id="svg-toolbar" class="w-14 bg-surface border border-border rounded-2xl flex flex-col items-center py-3 gap-1 shrink-0">
          <button type="button" class="tool-btn p-2.5 rounded-xl bg-hover text-fg" data-tool="select" title="Select"><i data-lucide="mouse-pointer-2" class="w-5 h-5"></i></button>
          <button type="button" class="tool-btn p-2.5 rounded-xl text-muted hover:text-fg hover:bg-hover" data-tool="rect" title="Rectangle"><i data-lucide="square" class="w-5 h-5"></i></button>
          <button type="button" class="tool-btn p-2.5 rounded-xl text-muted hover:text-fg hover:bg-hover" data-tool="circle" title="Circle"><i data-lucide="circle" class="w-5 h-5"></i></button>
          <button type="button" class="tool-btn p-2.5 rounded-xl text-muted hover:text-fg hover:bg-hover" data-tool="line" title="Line"><i data-lucide="minus" class="w-5 h-5"></i></button>
          <button type="button" class="tool-btn p-2.5 rounded-xl text-muted hover:text-fg hover:bg-hover" data-tool="text" title="Text"><i data-lucide="type" class="w-5 h-5"></i></button>
          <div class="w-8 h-px bg-border my-2"></div>
          <button type="button" class="tool-btn p-2.5 rounded-xl text-muted hover:text-fg hover:bg-hover" data-tool="delete" title="Delete selected"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
          <button type="button" class="tool-btn p-2.5 rounded-xl text-muted hover:text-fg hover:bg-hover" data-tool="clear" title="Clear all"><i data-lucide="eraser" class="w-5 h-5"></i></button>
        </div>

        <div id="visual-panel" class="flex-1 bg-surface border border-border rounded-2xl relative overflow-hidden min-h-[28rem]">
          <svg id="svg-canvas" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" class="w-full h-full cursor-crosshair" style="min-height:28rem;background-image:radial-gradient(circle, #333 1px, transparent 1px);background-size:16px 16px;background-color:#0a0a0a;">
          </svg>
        </div>

        <div id="source-panel" class="hidden flex-1 min-h-[28rem]">
          <textarea id="svg-source" class="w-full h-full min-h-[28rem] bg-surface border border-border rounded-2xl p-4 font-mono text-sm text-fg outline-none resize-none" spellcheck="false"></textarea>
        </div>
      </div>
    </div>
  `;

  const svgCanvas = document.getElementById("svg-canvas");
  const sourcePanel = document.getElementById("source-panel");
  const visualPanel = document.getElementById("visual-panel");
  const sourceEl = document.getElementById("svg-source");
  const ns = "http://www.w3.org/2000/svg";

  let activeTool = "select";
  let mode = "visual";
  let isDrawing = false;
  let startX = 0, startY = 0;
  let currentElement = null;
  let selected = null;

  function toSvgPoint(e) {
    const pt = svgCanvas.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgCanvas.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function updateSource() {
    if (sourceEl) sourceEl.value = new XMLSerializer().serializeToString(svgCanvas);
  }

  function setTool(tool) {
    activeTool = tool;
    document.querySelectorAll(".tool-btn").forEach((b) => {
      const on = b.dataset.tool === tool;
      b.classList.toggle("bg-hover", on);
      b.classList.toggle("text-fg", on);
      b.classList.toggle("text-muted", !on);
    });
  }

  document.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tool = btn.dataset.tool;
      if (tool === "clear") {
        while (svgCanvas.firstChild) svgCanvas.removeChild(svgCanvas.firstChild);
        selected = null;
        updateSource();
        return;
      }
      if (tool === "delete") {
        if (selected && selected.parentNode === svgCanvas) {
          svgCanvas.removeChild(selected);
          selected = null;
          updateSource();
        }
        return;
      }
      setTool(tool);
    });
  });

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      document.querySelectorAll(".mode-btn").forEach((b) => {
        const on = b.dataset.mode === mode;
        b.classList.toggle("bg-primary", on);
        b.classList.toggle("text-primary-fg", on);
        b.classList.toggle("text-muted", !on);
      });
      if (mode === "source") {
        updateSource();
        visualPanel.classList.add("hidden");
        sourcePanel.classList.remove("hidden");
      } else {
        // apply source back if edited
        try {
          const parsed = new DOMParser().parseFromString(sourceEl.value, "image/svg+xml");
          const svg = parsed.querySelector("svg");
          if (svg) {
            while (svgCanvas.firstChild) svgCanvas.removeChild(svgCanvas.firstChild);
            Array.from(svg.children).forEach((c) => svgCanvas.appendChild(document.importNode(c, true)));
          }
        } catch (_) {}
        sourcePanel.classList.add("hidden");
        visualPanel.classList.remove("hidden");
      }
    });
  });

  svgCanvas.addEventListener("mousedown", (e) => {
    if (mode !== "visual") return;
    const p = toSvgPoint(e);
    startX = p.x;
    startY = p.y;

    if (activeTool === "select") {
      const t = e.target;
      if (t && t !== svgCanvas) {
        selected = t;
        Array.from(svgCanvas.children).forEach((c) => c.removeAttribute("stroke-dasharray"));
        selected.setAttribute("stroke-dasharray", "4 2");
      } else {
        selected = null;
        Array.from(svgCanvas.children).forEach((c) => c.removeAttribute("stroke-dasharray"));
      }
      return;
    }

    if (activeTool === "text") {
      const text = prompt("Text:", "Hello");
      if (!text) return;
      const el = document.createElementNS(ns, "text");
      el.setAttribute("x", startX);
      el.setAttribute("y", startY);
      el.setAttribute("fill", "#e5e5e5");
      el.setAttribute("font-size", "20");
      el.textContent = text;
      svgCanvas.appendChild(el);
      updateSource();
      return;
    }

    isDrawing = true;
    if (activeTool === "rect") {
      currentElement = document.createElementNS(ns, "rect");
      currentElement.setAttribute("x", startX);
      currentElement.setAttribute("y", startY);
      currentElement.setAttribute("width", "1");
      currentElement.setAttribute("height", "1");
      currentElement.setAttribute("fill", "rgba(255,255,255,0.08)");
      currentElement.setAttribute("stroke", "#e5e5e5");
      currentElement.setAttribute("stroke-width", "2");
    } else if (activeTool === "circle") {
      currentElement = document.createElementNS(ns, "circle");
      currentElement.setAttribute("cx", startX);
      currentElement.setAttribute("cy", startY);
      currentElement.setAttribute("r", "1");
      currentElement.setAttribute("fill", "rgba(255,255,255,0.08)");
      currentElement.setAttribute("stroke", "#e5e5e5");
      currentElement.setAttribute("stroke-width", "2");
    } else if (activeTool === "line") {
      currentElement = document.createElementNS(ns, "line");
      currentElement.setAttribute("x1", startX);
      currentElement.setAttribute("y1", startY);
      currentElement.setAttribute("x2", startX);
      currentElement.setAttribute("y2", startY);
      currentElement.setAttribute("stroke", "#e5e5e5");
      currentElement.setAttribute("stroke-width", "2");
    }
    if (currentElement) svgCanvas.appendChild(currentElement);
  });

  svgCanvas.addEventListener("mousemove", (e) => {
    if (!isDrawing || !currentElement) return;
    const p = toSvgPoint(e);
    if (activeTool === "rect") {
      const w = Math.abs(p.x - startX);
      const h = Math.abs(p.y - startY);
      currentElement.setAttribute("x", Math.min(p.x, startX));
      currentElement.setAttribute("y", Math.min(p.y, startY));
      currentElement.setAttribute("width", Math.max(1, w));
      currentElement.setAttribute("height", Math.max(1, h));
    } else if (activeTool === "circle") {
      const r = Math.hypot(p.x - startX, p.y - startY);
      currentElement.setAttribute("r", Math.max(1, r));
    } else if (activeTool === "line") {
      currentElement.setAttribute("x2", p.x);
      currentElement.setAttribute("y2", p.y);
    }
  });

  svgCanvas.addEventListener("mouseup", () => {
    isDrawing = false;
    currentElement = null;
    updateSource();
  });

  document.getElementById("download-svg")?.addEventListener("click", () => {
    updateSource();
    const blob = new Blob([new XMLSerializer().serializeToString(svgCanvas)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "graphic.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("import-svg")?.addEventListener("click", () => {
    document.getElementById("svg-file")?.click();
  });
  document.getElementById("svg-file")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = new DOMParser().parseFromString(String(reader.result), "image/svg+xml");
        const svg = parsed.querySelector("svg");
        if (!svg) return;
        while (svgCanvas.firstChild) svgCanvas.removeChild(svgCanvas.firstChild);
        Array.from(svg.children).forEach((c) => {
          // basic sanitize: only geometry-ish nodes
          const name = c.tagName?.toLowerCase();
          if (["rect", "circle", "ellipse", "line", "path", "polygon", "polyline", "text", "g"].includes(name)) {
            svgCanvas.appendChild(document.importNode(c, true));
          }
        });
        updateSource();
      } catch (_) {}
    };
    reader.readAsText(file);
  });

  updateSource();
}

export { renderSvg };
