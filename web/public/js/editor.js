(function () {
  'use strict';
  // CodeMirror or Monaco would be loaded here in production.
  // For self-contained deployment we use a robust textarea-based editor with language modes.
  const editorEl = document.getElementById('code-editor');
  const langSelect = document.getElementById('editor-lang');
  const downloadBtn = document.getElementById('editor-download');
  const fontSizeInput = document.getElementById('editor-fontsize');

  if (!editorEl) return;

  const defaultCode = {
    javascript: '// Byteforge Code Editor\nconsole.log("Hello from Byteforge");\n',
    python: '# Byteforge Code Editor\nprint("Hello from Byteforge")\n',
    go: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from Byteforge")\n}\n',
    html: '<!DOCTYPE html>\n<html>\n<head><title>Byteforge</title></head>\n<body>\n  <h1>Hello from Byteforge</h1>\n</body>\n</html>\n',
    css: '/* Byteforge */\nbody {\n  font-family: system-ui;\n  background: #0d0f12;\n  color: #e8eaed;\n}\n',
    markdown: '# Byteforge\n\nA universal toolkit for files, code, documents, feeds and sound.\n',
  };

  if (langSelect) {
    langSelect.addEventListener('change', () => {
      const lang = langSelect.value;
      if (defaultCode[lang] && (!editorEl.value || editorEl.value.trim() === '')) {
        editorEl.value = defaultCode[lang];
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const lang = langSelect ? langSelect.value : 'txt';
      const ext = { javascript: 'js', typescript: 'ts', python: 'py', go: 'go', rust: 'rs', html: 'html', css: 'css', json: 'json', markdown: 'md', sql: 'sql', bash: 'sh' }[lang] || 'txt';
      const blob = new Blob([editorEl.value], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'code.' + ext;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  if (fontSizeInput) {
    fontSizeInput.addEventListener('input', () => {
      editorEl.style.fontSize = fontSizeInput.value + 'px';
    });
  }

  // Load saved font size
  const saved = localStorage.getItem('byteforge_editor_fontsize');
  if (saved && fontSizeInput) {
    fontSizeInput.value = saved;
    editorEl.style.fontSize = saved + 'px';
  }
  if (fontSizeInput) {
    fontSizeInput.addEventListener('change', () => {
      localStorage.setItem('byteforge_editor_fontsize', fontSizeInput.value);
    });
  }

  // Tab key support
  editorEl.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editorEl.selectionStart;
      const end = editorEl.selectionEnd;
      editorEl.value = editorEl.value.substring(0, start) + '  ' + editorEl.value.substring(end);
      editorEl.selectionStart = editorEl.selectionEnd = start + 2;
    }
  });
})();
