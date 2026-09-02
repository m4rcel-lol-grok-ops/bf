function initCommandPalette(router) {
  const backdrop = document.getElementById("cmd-palette-backdrop");
  const palette = document.getElementById("cmd-palette");
  const input = document.getElementById("cmd-input");
  const resultsContainer = document.getElementById("cmd-results");
  if (!backdrop || !palette || !input || !resultsContainer) return;
  let isOpen = false;
  const openPalette = () => {
    isOpen = true;
    backdrop.classList.remove("hidden");
    void backdrop.offsetWidth;
    backdrop.classList.remove("opacity-0");
    palette.classList.remove("scale-95");
    palette.classList.add("scale-100");
    input.value = "";
    renderResults("");
    input.focus();
  };
  const closePalette = () => {
    isOpen = false;
    backdrop.classList.add("opacity-0");
    palette.classList.remove("scale-100");
    palette.classList.add("scale-95");
    setTimeout(() => {
      if (!isOpen) backdrop.classList.add("hidden");
    }, 200);
  };
  const renderResults = (query) => {
    const q = query.toLowerCase();
    const matches = router.routes.filter((r) => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    if (matches.length === 0) {
      resultsContainer.innerHTML = `<div class="p-4 text-center text-muted">No results found</div>`;
      return;
    }
    resultsContainer.innerHTML = matches.map((r, idx) => `
      <div class="cmd-item p-3 flex items-center gap-3 hover:bg-hover rounded-xl cursor-pointer ${idx === 0 ? "bg-hover" : ""}" data-path="${r.path}">
        <i data-lucide="${r.icon}" class="w-5 h-5 text-muted"></i>
        <span class="text-fg">${r.label}</span>
      </div>
    `).join("");
    import("./main.js").then((m) => m.refreshIcons());
    document.querySelectorAll(".cmd-item").forEach((item) => {
      item.addEventListener("click", () => {
        router.navigate(item.getAttribute("data-path"));
        closePalette();
      });
    });
  };
  input.addEventListener("input", (e) => {
    renderResults(e.target.value);
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (isOpen) closePalette();
      else openPalette();
    }
    if (e.key === "Escape" && isOpen) {
      closePalette();
    }
    if (e.key === "Enter" && isOpen) {
      const active = document.querySelector(".cmd-item.bg-hover");
      if (active) {
        router.navigate(active.getAttribute("data-path"));
        closePalette();
      }
    }
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closePalette();
  });
}
export {
  initCommandPalette
};
