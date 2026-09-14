/**
 * storage.js
 * Client-side data layer. Talks to the Express API on the server so that
 * all items, sales, and settings are shared across every device/browser
 * that logs in — not stored per-browser like the old localStorage version.
 */

const DB = {
  cache: { items: [], sales: [], settings: {} },

  async _request(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      let message = 'Request failed';
      try {
        const body = await res.json();
        message = body.error || message;
      } catch (e) { /* ignore */ }
      const err = new Error(message);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  },

  // ---------- initial load ----------
  async loadAll() {
    const data = await this._request('/api/state');
    this.cache.items = data.items || [];
    this.cache.sales = data.sales || [];
    this.cache.settings = data.settings || {};
    return data;
  },

  // ---------- synchronous getters (read from cache) ----------
  getItems() {
    return this.cache.items;
  },
  getSales() {
    return this.cache.sales;
  },
  getSettings() {
    return this.cache.settings;
  },

  // ---------- items (async — persisted on the server) ----------
  async addItem(item) {
    const saved = await this._request('/api/items', { method: 'POST', body: JSON.stringify(item) });
    this.cache.items.push(saved);
    return saved;
  },
  async updateItem(updated) {
    const saved = await this._request(`/api/items/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      body: JSON.stringify(updated),
    });
    this.cache.items = this.cache.items.map(i => (i.id === saved.id ? saved : i));
    return saved;
  },
  async deleteItem(id) {
    await this._request(`/api/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
    this.cache.items = this.cache.items.filter(i => i.id !== id);
  },

  // ---------- sales ----------
  // Stock is validated & deducted server-side; the server returns the
  // saved sale plus the fresh item list (with updated stock levels).
  async addSale(sale) {
    const result = await this._request('/api/sales', { method: 'POST', body: JSON.stringify(sale) });
    this.cache.sales.push(result.sale);
    this.cache.items = result.items;
    return result.sale;
  },

  // ---------- settings ----------
  async saveSettings(settings) {
    const saved = await this._request('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
    this.cache.settings = saved;
    return saved;
  },
};
