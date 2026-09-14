/**
 * pos.js
 * Point-of-Sale screen: tap a product to open a quick-add popup (quantity
 * + confirm), build a cart, take payment, and check out.
 */

const POS = {
  cart: [], // { id, name, price, qty }
  quickAddItem: null,
  quickAddQty: 1,

  init() {
    document.getElementById('posSearch').addEventListener('input', () => this.renderItemGrid());
    document.getElementById('posCategoryFilter').addEventListener('change', () => this.renderItemGrid());
    document.getElementById('amountPaid').addEventListener('input', () => this.renderCartSummary());
    document.getElementById('clearCartBtn').addEventListener('click', () => this.clearCart());
    document.getElementById('checkoutBtn').addEventListener('click', () => this.checkout());

    // Quick-add popup controls
    document.getElementById('qaMinus').addEventListener('click', () => this.changeQuickAddQty(-1));
    document.getElementById('qaPlus').addEventListener('click', () => this.changeQuickAddQty(1));
    document.getElementById('qaCancel').addEventListener('click', () => UI.closeModal('quickAddModal'));
    document.getElementById('qaAddBtn').addEventListener('click', () => this.confirmQuickAdd());

    this.renderCategoryFilter();
    this.renderItemGrid();
    this.renderCart();
  },

  renderCategoryFilter() {
    const select = document.getElementById('posCategoryFilter');
    const categories = [...new Set(DB.getItems().map(i => i.category))].sort();
    const current = select.value;
    select.innerHTML = '<option value="all">All Categories</option>' +
      categories.map(c => `<option value="${UI.escapeHtml(c)}">${UI.escapeHtml(c)}</option>`).join('');
    if (categories.includes(current)) select.value = current;
  },

  renderItemGrid() {
    const grid = document.getElementById('posItemGrid');
    const search = document.getElementById('posSearch').value.trim().toLowerCase();
    const category = document.getElementById('posCategoryFilter').value;

    let items = DB.getItems();
    if (category !== 'all') items = items.filter(i => i.category === category);
    if (search) {
      items = items.filter(i =>
        i.name.toLowerCase().includes(search) ||
        (i.sku || '').toLowerCase().includes(search)
      );
    }

    if (items.length === 0) {
      grid.innerHTML = '<p class="empty-hint">No products match your search.</p>';
      return;
    }

    grid.innerHTML = items.map(item => {
      const outOfStock = item.stock <= 0;
      const lowStock = !outOfStock && item.stock <= item.lowStockThreshold;
      return `
        <div class="item-card ${outOfStock ? 'out-of-stock' : ''}" data-id="${item.id}">
          <span class="stock-badge ${lowStock ? 'low' : ''}">${outOfStock ? 'Out' : item.stock + ' left'}</span>
          <span class="icon">${item.icon || '🛍️'}</span>
          <div class="name">${UI.escapeHtml(item.name)}</div>
          <div class="price">${UI.peso(item.price)}</div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('out-of-stock')) return;
        this.openQuickAdd(card.dataset.id);
      });
    });
  },

  // ---------- quick-add popup (shown instead of silently adding + scrolling) ----------
  openQuickAdd(itemId) {
    const item = DB.getItems().find(i => i.id === itemId);
    if (!item || item.stock <= 0) return;

    this.quickAddItem = item;
    this.quickAddQty = 1;
    this.renderQuickAdd();
    UI.openModal('quickAddModal');
  },

  renderQuickAdd() {
    const item = this.quickAddItem;
    if (!item) return;

    const inCart = this.cart.find(c => c.id === item.id);
    const alreadyInCart = inCart ? inCart.qty : 0;
    const maxAddable = Math.max(item.stock - alreadyInCart, 0);

    if (this.quickAddQty > maxAddable) this.quickAddQty = Math.max(maxAddable, 1);

    document.getElementById('qaIcon').textContent = item.icon || '🛍️';
    document.getElementById('qaName').textContent = item.name;
    document.getElementById('qaPrice').textContent = `${UI.peso(item.price)} each`;
    document.getElementById('qaQty').textContent = this.quickAddQty;

    const note = document.getElementById('qaStockNote');
    note.textContent = alreadyInCart
      ? `${item.stock} in stock • ${alreadyInCart} already in cart`
      : `${item.stock} in stock`;

    document.getElementById('qaMinus').disabled = this.quickAddQty <= 1;
    document.getElementById('qaPlus').disabled = this.quickAddQty >= maxAddable;
    document.getElementById('qaAddBtn').disabled = maxAddable <= 0;
  },

  changeQuickAddQty(delta) {
    const item = this.quickAddItem;
    if (!item) return;
    const inCart = this.cart.find(c => c.id === item.id);
    const alreadyInCart = inCart ? inCart.qty : 0;
    const maxAddable = Math.max(item.stock - alreadyInCart, 0);

    const newQty = this.quickAddQty + delta;
    if (newQty >= 1 && newQty <= maxAddable) {
      this.quickAddQty = newQty;
      this.renderQuickAdd();
    }
  },

  confirmQuickAdd() {
    const item = this.quickAddItem;
    if (!item || this.quickAddQty < 1) return;

    const existing = this.cart.find(c => c.id === item.id);
    if (existing) {
      existing.qty += this.quickAddQty;
    } else {
      this.cart.push({ id: item.id, name: item.name, price: item.price, qty: this.quickAddQty });
    }

    UI.closeModal('quickAddModal');
    UI.toast(`Added ${this.quickAddQty} × ${item.name} to cart`);
    this.renderCart();
  },

  // ---------- cart ----------
  changeQty(itemId, delta) {
    const line = this.cart.find(c => c.id === itemId);
    if (!line) return;
    const stockItem = DB.getItems().find(i => i.id === itemId);

    const newQty = line.qty + delta;
    if (newQty <= 0) {
      this.cart = this.cart.filter(c => c.id !== itemId);
    } else if (stockItem && newQty > stockItem.stock) {
      UI.toast(`Only ${stockItem.stock} ${stockItem.name} in stock.`);
      return;
    } else {
      line.qty = newQty;
    }
    this.renderCart();
  },

  removeFromCart(itemId) {
    this.cart = this.cart.filter(c => c.id !== itemId);
    this.renderCart();
  },

  clearCart() {
    this.cart = [];
    document.getElementById('amountPaid').value = '';
    this.renderCart();
  },

  getTotal() {
    return this.cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  },

  renderCart() {
    const list = document.getElementById('cartList');
    if (this.cart.length === 0) {
      list.innerHTML = '<p class="empty-hint">Tap a product to add it to the sale.</p>';
    } else {
      list.innerHTML = this.cart.map(c => `
        <div class="cart-item" data-id="${c.id}">
          <div class="ci-info">
            <div class="ci-name">${UI.escapeHtml(c.name)}</div>
            <div class="ci-unit">${UI.peso(c.price)} each</div>
          </div>
          <div class="qty-control">
            <button class="qty-minus" aria-label="Decrease">−</button>
            <span>${c.qty}</span>
            <button class="qty-plus" aria-label="Increase">+</button>
          </div>
          <div class="ci-subtotal">${UI.peso(c.price * c.qty)}</div>
          <button class="ci-remove" aria-label="Remove">✕</button>
        </div>
      `).join('');

      list.querySelectorAll('.cart-item').forEach(row => {
        const id = row.dataset.id;
        row.querySelector('.qty-plus').addEventListener('click', () => this.changeQty(id, 1));
        row.querySelector('.qty-minus').addEventListener('click', () => this.changeQty(id, -1));
        row.querySelector('.ci-remove').addEventListener('click', () => this.removeFromCart(id));
      });
    }
    // Refresh the grid so stock badges reflect quantities held in the cart.
    this.renderItemGrid();
    this.renderCartSummary();
    this.renderFloatingCart();
  },

  renderCartSummary() {
    const total = this.getTotal();
    const paid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const change = paid - total;
    const itemCount = this.cart.reduce((sum, c) => sum + c.qty, 0);

    document.getElementById('cartItemCount').textContent = itemCount;
    document.getElementById('cartTotal').textContent = UI.peso(total);
    document.getElementById('cartChange').textContent = UI.peso(Math.max(change, 0));

    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = this.cart.length === 0 || paid < total;
  },

  // Small sticky bar (mobile) so the cart total is always visible without
  // needing to scroll down to the cart panel.
  renderFloatingCart() {
    const bar = document.getElementById('floatingCartBar');
    if (!bar) return;
    const itemCount = this.cart.reduce((sum, c) => sum + c.qty, 0);
    if (itemCount === 0) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    document.getElementById('floatingCartCount').textContent = itemCount;
    document.getElementById('floatingCartTotal').textContent = UI.peso(this.getTotal());
  },

  async checkout() {
    const total = this.getTotal();
    const paid = parseFloat(document.getElementById('amountPaid').value) || 0;

    if (this.cart.length === 0) {
      UI.toast('Cart is empty.');
      return;
    }
    if (paid < total) {
      UI.toast('Amount paid is less than the total.');
      return;
    }

    const cashier = document.getElementById('cashierName').value.trim() || 'Unassigned';
    const change = paid - total;

    const sale = {
      datetime: new Date().toISOString(),
      cashier,
      items: this.cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty, subtotal: c.price * c.qty })),
      total,
      amountPaid: paid,
      change,
    };

    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = true;

    try {
      const savedSale = await DB.addSale(sale);
      Receipt.show(savedSale);
      this.clearCart();
      Inventory.render();
      if (typeof Reports !== 'undefined') Reports.render();
    } catch (err) {
      UI.toast(err.message || 'Checkout failed. Please try again.');
      this.renderCartSummary();
    }
  },
};
