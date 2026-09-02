function renderPlaceholder(title) {
  return (container) => {
    container.innerHTML = `
      <div class="max-w-3xl mx-auto flex flex-col items-center justify-center h-full text-center mt-20">
        <div class="w-20 h-20 bg-surface border border-border rounded-2xl flex items-center justify-center mb-6">
          <i data-lucide="wrench" class="w-10 h-10 text-muted"></i>
        </div>
        <h1 class="text-3xl font-bold tracking-tight mb-4">${title}</h1>
        <p class="text-muted text-lg max-w-md">This tool is currently under construction. Please check back later.</p>
      </div>
    `;
  };
}
export {
  renderPlaceholder
};
