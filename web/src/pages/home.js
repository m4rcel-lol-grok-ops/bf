function renderHome(container) {
  import("../router.js").then(({ routes }) => {
    const tools = routes.filter((r) => r.path !== "/" && r.path !== "/settings");
    container.innerHTML = `
      <div class="max-w-5xl mx-auto flex flex-col gap-8">
        <header class="flex justify-between items-start mb-16">
          <div>
            <h1 class="text-4xl font-semibold tracking-tight text-primary mb-2">Byteforge</h1>
            <p class="text-muted text-lg max-w-md font-medium">A universal toolkit for files, code, documents, feeds and sound.</p>
          </div>
          <div class="hidden md:flex items-center gap-3 bg-surface-alt border border-border rounded-full px-5 py-2.5 cursor-pointer text-sm text-muted">
            <span>Find a tool...</span>
            <span class="bg-border text-muted-dark px-2 py-0.5 rounded text-[11px] font-bold">\u2318 K</span>
          </div>
        </header>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          ${tools.map((tool) => `
            <a href="${tool.path}" class="group block p-6 rounded-[20px] bg-surface border border-border flex flex-col gap-4 hover:border-border-hover transition-colors">
              <div class="w-12 h-12 bg-surface-alt rounded-2xl flex items-center justify-center border border-border group-hover:bg-primary transition-colors duration-300">
                <i data-lucide="${tool.icon}" class="w-6 h-6 text-fg group-hover:text-primary-fg transition-colors"></i>
              </div>
              <div>
                <h3 class="text-lg font-semibold mb-1">${tool.label}</h3>
                <p class="text-sm text-muted">Open ${tool.label}.</p>
              </div>
            </a>
          `).join("")}
        </div>

        <footer class="mt-16 flex justify-between items-center text-[12px] text-muted-alt border-t border-border pt-6">
          <div class="flex gap-6 uppercase tracking-widest font-bold">
            <span class="text-muted">Byteforge</span>
            <span>Self-hosted</span>
          </div>
        </footer>
      </div>
    `;
  });
}
export {
  renderHome
};
