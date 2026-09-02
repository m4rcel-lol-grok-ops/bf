function renderSettings(container) {
  const fontSize = localStorage.getItem("byteforge-editor-size") || "16";
  const theme = localStorage.getItem("byteforge-theme") || "dark";
  const bbRate = localStorage.getItem("byteforge-bb-rate") || "8000";
  const wordWrap = localStorage.getItem("byteforge-editor-wordwrap") === "true";

  container.innerHTML = `
    <div class="max-w-lg mx-auto flex flex-col gap-6">
      <header>
        <h1 class="text-3xl font-bold tracking-tight mb-2">Settings</h1>
        <p class="text-muted">Preferences are stored in this browser only.</p>
      </header>

      <form id="settings-form" class="bg-surface border border-border rounded-3xl p-6 flex flex-col gap-5">
        <div>
          <label class="block text-sm text-muted mb-2">Editor font size</label>
          <input type="number" id="set-font" min="10" max="32" value="${fontSize}"
            class="w-full bg-bg border border-border rounded-full px-4 py-2.5 text-fg outline-none" />
        </div>
        <div class="flex items-center justify-between gap-4">
          <label class="text-sm text-muted" for="set-wrap">Editor word wrap</label>
          <input type="checkbox" id="set-wrap" ${wordWrap ? "checked" : ""} class="w-5 h-5" />
        </div>
        <div>
          <label class="block text-sm text-muted mb-2">Theme</label>
          <select id="set-theme" class="w-full bg-bg border border-border rounded-full px-4 py-2.5 text-fg outline-none">
            <option value="dark" ${theme === "dark" ? "selected" : ""}>Dark</option>
            <option value="light" ${theme === "light" ? "selected" : ""}>Light</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-muted mb-2">Bytebeat default sample rate</label>
          <select id="set-rate" class="w-full bg-bg border border-border rounded-full px-4 py-2.5 text-fg outline-none">
            ${["8000", "11025", "16000", "22050", "44100", "48000"]
              .map((r) => `<option value="${r}" ${bbRate === r ? "selected" : ""}>${r}</option>`)
              .join("")}
          </select>
        </div>
        <button type="submit" class="bg-primary text-primary-fg font-semibold px-6 py-3 rounded-full hover:opacity-90 self-start">
          Save
        </button>
        <p id="settings-status" class="text-sm text-muted"></p>
      </form>
    </div>
  `;

  document.getElementById("settings-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const size = document.getElementById("set-font")?.value || "16";
    const wrap = document.getElementById("set-wrap")?.checked;
    const th = document.getElementById("set-theme")?.value || "dark";
    const rate = document.getElementById("set-rate")?.value || "8000";

    localStorage.setItem("byteforge-editor-size", size);
    localStorage.setItem("byteforge-editor-wordwrap", String(!!wrap));
    localStorage.setItem("byteforge-theme", th);
    localStorage.setItem("byteforge-bb-rate", rate);

    const isLight = th === "light";
    document.documentElement.classList.toggle("light", isLight);
    document.querySelector(".theme-icon-light")?.classList.toggle("hidden", !isLight);
    document.querySelector(".theme-icon-dark")?.classList.toggle("hidden", isLight);

    const st = document.getElementById("settings-status");
    if (st) st.textContent = "Saved";
  });
}

export { renderSettings };
