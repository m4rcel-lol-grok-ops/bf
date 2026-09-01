(function () {
  'use strict';
  const canvas = document.getElementById('svg-canvas');
  const sourceEl = document.getElementById('svg-source');
  const modeBtns = document.querySelectorAll('[data-svg-mode]');
  const toolBtns = document.querySelectorAll('[data-svg-tool]');
  const exportBtn = document.getElementById('svg-export');
  const importInput = document.getElementById('svg-import');

  if (!canvas) return;

  let mode = 'visual';
  let tool = 'select';
  let shapes = [];
  let selected = null;
  let dragging = false;
  let startX = 0, startY = 0;

  const ns = 'http://www.w3.org/2000/svg';

  function render() {
    while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
    shapes.forEach((s, i) => {
      let el;
      if (s.type === 'rect') {
        el = document.createElementNS(ns, 'rect');
        el.setAttribute('x', s.x); el.setAttribute('y', s.y);
        el.setAttribute('width', s.w); el.setAttribute('height', s.h);
      } else if (s.type === 'circle') {
        el = document.createElementNS(ns, 'circle');
        el.setAttribute('cx', s.x); el.setAttribute('cy', s.y);
        el.setAttribute('r', s.r);
      } else if (s.type === 'line') {
        el = document.createElementNS(ns, 'line');
        el.setAttribute('x1', s.x1); el.setAttribute('y1', s.y1);
        el.setAttribute('x2', s.x2); el.setAttribute('y2', s.y2);
      } else if (s.type === 'text') {
        el = document.createElementNS(ns, 'text');
        el.setAttribute('x', s.x); el.setAttribute('y', s.y);
        el.textContent = s.text || 'Text';
      }
      if (el) {
        el.setAttribute('fill', s.fill || 'none');
        el.setAttribute('stroke', s.stroke || '#5b9cff');
        el.setAttribute('stroke-width', s.sw || 2);
        el.setAttribute('data-idx', i);
        if (selected === i) el.setAttribute('stroke-dasharray', '4');
        el.style.cursor = 'pointer';
        canvas.appendChild(el);
      }
    });
    updateSource();
  }

  function updateSource() {
    if (!sourceEl) return;
    const serializer = new XMLSerializer();
    sourceEl.value = serializer.serializeToString(canvas);
  }

  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.svgMode;
      document.querySelectorAll('.svg-panel').forEach((p) => p.classList.add('hidden'));
      const panel = document.getElementById('svg-panel-' + mode);
      if (panel) panel.classList.remove('hidden');
      if (mode === 'source') updateSource();
    });
  });

  toolBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tool = btn.dataset.svgTool;
      toolBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  canvas.addEventListener('mousedown', (e) => {
    if (mode !== 'visual') return;
    const pt = canvas.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = canvas.getScreenCTM().inverse();
    const svgP = pt.matrixTransform(ctm);
    startX = svgP.x; startY = svgP.y;

    if (tool === 'rect') {
      shapes.push({ type: 'rect', x: startX, y: startY, w: 1, h: 1, fill: 'rgba(91,156,255,0.2)', stroke: '#5b9cff', sw: 2 });
      selected = shapes.length - 1;
      dragging = true;
    } else if (tool === 'circle') {
      shapes.push({ type: 'circle', x: startX, y: startY, r: 1, fill: 'rgba(91,156,255,0.2)', stroke: '#5b9cff', sw: 2 });
      selected = shapes.length - 1;
      dragging = true;
    } else if (tool === 'line') {
      shapes.push({ type: 'line', x1: startX, y1: startY, x2: startX, y2: startY, stroke: '#5b9cff', sw: 2 });
      selected = shapes.length - 1;
      dragging = true;
    } else if (tool === 'text') {
      const text = prompt('Text:', 'Hello');
      if (text) {
        shapes.push({ type: 'text', x: startX, y: startY, text, fill: '#e8eaed', stroke: 'none' });
        selected = shapes.length - 1;
        render();
      }
    } else if (tool === 'select') {
      const target = e.target.closest('[data-idx]');
      selected = target ? parseInt(target.getAttribute('data-idx'), 10) : null;
      render();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!dragging || selected === null) return;
    const pt = canvas.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(canvas.getScreenCTM().inverse());
    const s = shapes[selected];
    if (s.type === 'rect') {
      s.w = Math.max(1, svgP.x - s.x);
      s.h = Math.max(1, svgP.y - s.y);
    } else if (s.type === 'circle') {
      s.r = Math.max(1, Math.hypot(svgP.x - s.x, svgP.y - s.y));
    } else if (s.type === 'line') {
      s.x2 = svgP.x; s.y2 = svgP.y;
    }
    render();
  });

  canvas.addEventListener('mouseup', () => { dragging = false; });

  document.getElementById('svg-delete')?.addEventListener('click', () => {
    if (selected !== null) {
      shapes.splice(selected, 1);
      selected = null;
      render();
    }
  });

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      updateSource();
      const blob = new Blob([sourceEl ? sourceEl.value : ''], { type: 'image/svg+xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'drawing.svg';
      a.click();
    });
  }

  if (importInput) {
    importInput.addEventListener('change', () => {
      const file = importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        // Basic sanitization: only allow svg elements
        const parser = new DOMParser();
        const doc = parser.parseFromString(reader.result, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        if (svg) {
          while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
          Array.from(svg.children).forEach((c) => canvas.appendChild(document.importNode(c, true)));
          shapes = []; // reset internal model for imported
          updateSource();
        }
      };
      reader.readAsText(file);
    });
  }

  // Initial empty canvas size
  canvas.setAttribute('viewBox', '0 0 800 500');
  canvas.setAttribute('width', '100%');
  canvas.setAttribute('height', '400');
})();
