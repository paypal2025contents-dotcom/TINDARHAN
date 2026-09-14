/**
 * inventory.js
 * Inventory management: list, search, add, edit, delete items.
 * All mutations are persisted on the server via DB (see storage.js).
 */

const Inventory = {
  init() {
    document.getElementById('invSearch').addEventListener('input', () => this.render());
    document.getElementById('addItemBtn').addEventListener('click', () => this.openForm());
    document.getElementById('cancelItemBtn').addEventListener('click', () => UI.closeModal('itemModal'));
    document.getElementById('itemForm').addEventListener('submit', (e) => this.saveForm(e));
    document.getElementById('deleteItemBtn').addEventListener('click', () => this.deleteCurrent());

    this.render();
  },

  render() {
    this.renderCategoryDatalist();
    const tbody = document.getElementById('inventoryTableBody');
    const search = document.getElementById('invSearch').value.trim().toLowerCase();

    let items = DB.getItems();
    if (search) {
      items = items.filter(i =>
        i.name.toLowerCase().includes(search) ||
        i.category.toLowerCase().includes(search) ||
        (i.sku || '').toLowerCase().includes(search)
      );
    }

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#999;">No items found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => {
      let status = `<span class="badge ok">In Stock</span>`;
      if (item.stock <= 0) status = `<span class="badge out">Out of Stock</span>`;
      else if (item.stock <= item.lowStockThreshold) status = `<span class="badge low">Low Stock</span>`;

      return `
        <tr data-id="${item.id}">
          <td style="font-size:20px;">${item.icon || '🛍️'}</td>
          <td>${UI.escapeHtml(item.name)}</td>
          <td>${UI.escapeHtml(item.category)}</td>
          <td>${UI.escapeHtml(item.sku)}</td>
          <td>${UI.peso(item.price)}</td>
          <td>${item.stock}</td>
          <td>${status}</td>
          <td>
            <button class="icon-btn edit-btn" title="Edit">✏️</button>
            <button class="icon-btn del-btn" title="Delete">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('.edit-btn').addEventListener('click', () => this.openForm(id));
      row.querySelector('.del-btn').addEventListener('click', () => this.confirmDelete(id));
    });

    // Keep POS filters/grid in sync with inventory changes.
    if (typeof POS !== 'undefined') {
      POS.renderCategoryFilter();
      POS.renderItemGrid();
    }
  },

  renderCategoryDatalist() {
    const list = document.getElementById('categoryList');
    const categories = [...new Set(DB.getItems().map(i => i.category))].sort();
    list.innerHTML = categories.map(c => `<option value="${UI.escapeHtml(c)}"></option>`).join('');
  },

  openForm(itemId = null) {
    const form = document.getElementById('itemForm');
    form.reset();
    document.getElementById('deleteItemBtn').classList.toggle('hidden', !itemId);

    if (itemId) {
      const item = DB.getItems().find(i => i.id === itemId);
      document.getElementById('itemModalTitle').textContent = 'Edit Item';
      document.getElementById('itemId').value = item.id;
      document.getElementById('itemName').value = item.name;
      document.getElementById('itemCategory').value = item.category;
      document.getElementById('itemSku').value = item.sku;
      document.getElementById('itemIcon').value = item.icon || '';
      document.getElementById('itemPrice').value = item.price;
      document.getElementById('itemStock').value = item.stock;
      document.getElementById('itemLowStock').value = item.lowStockThreshold;
    } else {
      document.getElementById('itemModalTitle').textContent = 'Add Item';
      document.getElementById('itemId').value = '';
      document.getElementById('itemLowStock').value = 5;
    }

    UI.openModal('itemModal');
  },

  async saveForm(e) {
    e.preventDefault();
    const id = document.getElementById('itemId').value;

    const data = {
      name: document.getElementById('itemName').value.trim(),
      category: document.getElementById('itemCategory').value.trim(),
      sku: document.getElementById('itemSku').value.trim(),
      icon: document.getElementById('itemIcon').value.trim(),
      price: parseFloat(document.getElementById('itemPrice').value) || 0,
      stock: parseInt(document.getElementById('itemStock').value, 10) || 0,
      lowStockThreshold: parseInt(document.getElementById('itemLowStock').value, 10) || 0,
    };

    if (!data.name || data.price < 0 || data.stock < 0) {
      UI.toast('Please fill in valid item details.');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (id) {
        data.id = id;
        await DB.updateItem(data);
        UI.toast('Item updated.');
      } else {
        await DB.addItem(data);
        UI.toast('Item added.');
      }
      UI.closeModal('itemModal');
      this.render();
    } catch (err) {
      UI.toast(err.message || 'Could not save item.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  },

  confirmDelete(itemId) {
    const item = DB.getItems().find(i => i.id === itemId);
    if (!item) return;
    if (confirm(`Delete "${item.name}" from inventory? This cannot be undone.`)) {
      DB.deleteItem(itemId)
        .then(() => {
          UI.toast('Item deleted.');
          this.render();
        })
        .catch(err => UI.toast(err.message || 'Could not delete item.'));
    }
  },

  deleteCurrent() {
    const id = document.getElementById('itemId').value;
    if (!id) return;
    this.confirmDelete(id);
    UI.closeModal('itemModal');
  },
};
