(function () {
  'use strict';
  const feedList = document.getElementById('feed-list');
  const itemList = document.getElementById('item-list');
  const addForm = document.getElementById('add-feed-form');
  const urlInput = document.getElementById('feed-url');
  const searchInput = document.getElementById('item-search');

  if (!feedList) return;

  let currentFeedId = null;

  async function loadFeeds() {
    const res = await fetch('/api/rss/feeds');
    const feeds = await res.json();
    feedList.innerHTML = '';
    if (!feeds.length) {
      feedList.innerHTML = '<p class="empty-state">No feeds yet. Add one above.</p>';
      return;
    }
    feeds.forEach((f) => {
      const div = document.createElement('div');
      div.className = 'feed-item' + (currentFeedId === f.id ? ' active' : '');
      div.innerHTML = '<strong>' + escapeHtml(f.title || f.url) + '</strong> <span class="badge">' + (f.item_count || 0) + '</span>';
      div.addEventListener('click', () => {
        currentFeedId = f.id;
        loadFeeds();
        loadItems();
      });
      const actions = document.createElement('div');
      actions.className = 'btn-row';
      const refresh = document.createElement('button');
      refresh.textContent = '↻';
      refresh.title = 'Refresh';
      refresh.addEventListener('click', async (e) => {
        e.stopPropagation();
        await fetch('/api/rss/feeds/' + f.id + '/refresh', { method: 'POST' });
        loadFeeds();
        loadItems();
      });
      const del = document.createElement('button');
      del.textContent = '×';
      del.title = 'Delete';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete feed?')) {
          await fetch('/api/rss/feeds/' + f.id, { method: 'DELETE' });
          if (currentFeedId === f.id) currentFeedId = null;
          loadFeeds();
          loadItems();
        }
      });
      actions.appendChild(refresh);
      actions.appendChild(del);
      div.appendChild(actions);
      feedList.appendChild(div);
    });
  }

  async function loadItems() {
    if (!itemList) return;
    let url = '/api/rss/items?limit=50';
    if (currentFeedId) url += '&feed_id=' + currentFeedId;
    if (searchInput && searchInput.value) url += '&q=' + encodeURIComponent(searchInput.value);
    const res = await fetch(url);
    const items = await res.json();
    itemList.innerHTML = '';
    if (!items.length) {
      itemList.innerHTML = '<p class="empty-state">No items</p>';
      return;
    }
    items.forEach((it) => {
      const div = document.createElement('div');
      div.className = 'rss-item' + (it.is_read ? ' read' : '');
      div.innerHTML = '<a href="' + escapeAttr(it.link) + '" target="_blank" rel="noopener">' + escapeHtml(it.title) + '</a>' +
        '<p class="muted">' + escapeHtml((it.description || '').slice(0, 160)) + '</p>';
      itemList.appendChild(div);
    });
  }

  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = urlInput.value.trim();
      if (!url) return;
      const res = await fetch('/api/rss/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      urlInput.value = '';
      loadFeeds();
    });
  }

  if (searchInput) {
    let t;
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(loadItems, 300);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }
  function escapeAttr(s) {
    return (s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  loadFeeds();
  loadItems();
})();
