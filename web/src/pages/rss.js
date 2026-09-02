function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}
function escapeAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderRss(container) {
  container.innerHTML = `
    <div class="max-w-6xl mx-auto flex flex-col gap-6">
      <header>
        <h1 class="text-3xl font-bold tracking-tight mb-2">RSS Reader</h1>
        <p class="text-muted">Subscribe to feeds, read articles, mark favorites.</p>
      </header>

      <form id="add-feed-form" class="flex flex-col sm:flex-row gap-3">
        <input type="url" id="feed-url" required placeholder="https://example.com/feed.xml"
          class="flex-1 bg-surface border border-border rounded-full px-5 py-3 text-fg outline-none focus:border-border-hover" />
        <button type="submit" class="bg-primary text-primary-fg font-semibold px-6 py-3 rounded-full hover:opacity-90 transition-opacity">
          Add feed
        </button>
      </form>
      <p id="rss-status" class="text-sm text-muted hidden"></p>

      <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div class="bg-surface border border-border rounded-3xl p-4">
          <h2 class="text-sm font-semibold text-muted mb-3 uppercase tracking-wider">Feeds</h2>
          <div id="feed-list" class="flex flex-col gap-1"></div>
        </div>
        <div class="bg-surface border border-border rounded-3xl p-4">
          <input type="search" id="item-search" placeholder="Search items…"
            class="w-full bg-bg border border-border rounded-full px-4 py-2.5 mb-4 text-sm outline-none focus:border-border-hover" />
          <div id="item-list" class="flex flex-col gap-3"></div>
        </div>
      </div>
    </div>
  `;

  let currentFeedId = null;
  const feedList = document.getElementById("feed-list");
  const itemList = document.getElementById("item-list");
  const statusEl = document.getElementById("rss-status");
  const searchInput = document.getElementById("item-search");

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("hidden", !msg);
    statusEl.classList.toggle("text-red-400", !!isError);
  }

  async function loadFeeds() {
    try {
      const res = await fetch("/api/rss/feeds");
      if (!res.ok) throw new Error(await res.text());
      const feeds = await res.json();
      feedList.innerHTML = "";
      if (!feeds.length) {
        feedList.innerHTML = `<p class="text-muted text-sm py-4 text-center">No feeds yet</p>`;
        return;
      }
      feeds.forEach((f) => {
        const row = document.createElement("div");
        row.className = "flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer hover:bg-hover transition-colors" +
          (currentFeedId === f.id ? " bg-active" : "");
        row.innerHTML = `
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">${escapeHtml(f.title || f.url)}</div>
            <div class="text-[11px] text-muted">${f.item_count || 0} items</div>
          </div>
          <button data-refresh class="p-1.5 rounded-lg hover:bg-border text-muted hover:text-fg" title="Refresh">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
          </button>
          <button data-del class="p-1.5 rounded-lg hover:bg-border text-muted hover:text-fg" title="Delete">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        `;
        row.addEventListener("click", (e) => {
          if (e.target.closest("[data-refresh]") || e.target.closest("[data-del]")) return;
          currentFeedId = f.id;
          loadFeeds();
          loadItems();
        });
        row.querySelector("[data-refresh]")?.addEventListener("click", async (e) => {
          e.stopPropagation();
          setStatus("Refreshing…");
          try {
            const r = await fetch("/api/rss/feeds/" + f.id + "/refresh", { method: "POST" });
            if (!r.ok) throw new Error(await r.text());
            setStatus("Refreshed");
            loadFeeds();
            loadItems();
          } catch (err) {
            setStatus(err.message || "Refresh failed", true);
          }
        });
        row.querySelector("[data-del]")?.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!confirm("Delete this feed?")) return;
          await fetch("/api/rss/feeds/" + f.id, { method: "DELETE" });
          if (currentFeedId === f.id) currentFeedId = null;
          loadFeeds();
          loadItems();
        });
        feedList.appendChild(row);
      });
      if (window.refreshIcons) window.refreshIcons();
      else {
        import("https://esm.sh/lucide@0.475.0").then((mod) => {
          mod.createIcons({ icons: mod, nameAttr: "data-lucide" });
        }).catch(() => {});
      }
    } catch (err) {
      setStatus(err.message || "Failed to load feeds", true);
    }
  }

  async function loadItems() {
    let url = "/api/rss/items?limit=50";
    if (currentFeedId) url += "&feed_id=" + currentFeedId;
    if (searchInput?.value) url += "&q=" + encodeURIComponent(searchInput.value);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      const items = await res.json();
      itemList.innerHTML = "";
      if (!items.length) {
        itemList.innerHTML = `<p class="text-muted text-sm py-8 text-center">No items</p>`;
        return;
      }
      items.forEach((it) => {
        const el = document.createElement("article");
        el.className = "border-b border-border pb-3 last:border-0";
        el.innerHTML = `
          <a href="${escapeAttr(it.link)}" target="_blank" rel="noopener" class="font-medium hover:opacity-80 transition-opacity">
            ${escapeHtml(it.title || "Untitled")}
          </a>
          <p class="text-sm text-muted mt-1 line-clamp-2">${escapeHtml((it.description || "").replace(/<[^>]+>/g, "").slice(0, 200))}</p>
        `;
        itemList.appendChild(el);
      });
    } catch (err) {
      itemList.innerHTML = `<p class="text-sm text-red-400">${escapeHtml(err.message)}</p>`;
    }
  }

  document.getElementById("add-feed-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("feed-url");
    const url = input?.value?.trim();
    if (!url) return;
    setStatus("Adding…");
    try {
      const res = await fetch("/api/rss/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(await res.text());
      input.value = "";
      setStatus("Feed added");
      loadFeeds();
      loadItems();
    } catch (err) {
      setStatus(err.message || "Failed to add feed", true);
    }
  });

  let searchTimer;
  searchInput?.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadItems, 300);
  });

  loadFeeds();
  loadItems();
}

export { renderRss };
