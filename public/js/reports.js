/**
 * reports.js
 * Sales reporting: date-filtered stats, top products, transaction log,
 * CSV export, and printable summary.
 */

const Reports = {
  filterFrom: null,
  filterTo: null,

  init() {
    document.getElementById('applyReportFilter').addEventListener('click', () => this.applyFilter());
    document.getElementById('resetReportFilter').addEventListener('click', () => this.resetFilter());
    document.getElementById('exportCsvBtn').addEventListener('click', () => this.exportCsv());
    document.getElementById('printReportBtn').addEventListener('click', () => this.printReport());
    this.render();
  },

  applyFilter() {
    const from = document.getElementById('reportFrom').value;
    const to = document.getElementById('reportTo').value;
    this.filterFrom = from ? new Date(from + 'T00:00:00') : null;
    this.filterTo = to ? new Date(to + 'T23:59:59') : null;
    this.render();
  },

  resetFilter() {
    document.getElementById('reportFrom').value = '';
    document.getElementById('reportTo').value = '';
    this.filterFrom = null;
    this.filterTo = null;
    this.render();
  },

  getFilteredSales() {
    return DB.getSales().filter(s => {
      const d = new Date(s.datetime);
      if (this.filterFrom && d < this.filterFrom) return false;
      if (this.filterTo && d > this.filterTo) return false;
      return true;
    });
  },

  render() {
    const sales = this.getFilteredSales().sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

    const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
    const totalTransactions = sales.length;
    const itemsSold = sales.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.qty, 0), 0);
    const avgSale = totalTransactions ? totalSales / totalTransactions : 0;

    document.getElementById('statTotalSales').textContent = UI.peso(totalSales);
    document.getElementById('statTransactions').textContent = totalTransactions;
    document.getElementById('statItemsSold').textContent = itemsSold;
    document.getElementById('statAvgSale').textContent = UI.peso(avgSale);

    this.renderTopProducts(sales);
    this.renderSalesTable(sales);
  },

  renderTopProducts(sales) {
    const tally = {};
    sales.forEach(s => {
      s.items.forEach(i => {
        tally[i.name] = (tally[i.name] || 0) + i.qty;
      });
    });

    const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const chart = document.getElementById('topProductsChart');

    if (ranked.length === 0) {
      chart.innerHTML = '<p class="empty-hint">No sales data yet.</p>';
      return;
    }

    const max = ranked[0][1];
    chart.innerHTML = ranked.map(([name, qty]) => `
      <div class="bar-row">
        <span class="bar-label" title="${UI.escapeHtml(name)}">${UI.escapeHtml(name)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(qty / max) * 100}%"></div></div>
        <span class="bar-value">${qty} pcs</span>
      </div>
    `).join('');
  },

  renderSalesTable(sales) {
    const tbody = document.getElementById('salesTableBody');
    if (sales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#999;">No transactions in this range.</td></tr>`;
      return;
    }

    tbody.innerHTML = sales.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${UI.formatDateTime(s.datetime)}</td>
        <td>${UI.escapeHtml(s.cashier)}</td>
        <td>${s.items.reduce((a, i) => a + i.qty, 0)}</td>
        <td>${UI.peso(s.total)}</td>
        <td><button class="icon-btn view-sale-btn" data-id="${s.id}" title="View receipt">🧾</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.view-sale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sale = DB.getSales().find(s => s.id === btn.dataset.id);
        if (sale) Receipt.show(sale);
      });
    });
  },

  exportCsv() {
    const sales = this.getFilteredSales();
    if (sales.length === 0) {
      UI.toast('No transactions to export.');
      return;
    }

    const rows = [['Sale ID', 'Date/Time', 'Cashier', 'Item', 'Qty', 'Unit Price', 'Subtotal', 'Sale Total', 'Amount Paid', 'Change']];
    sales.forEach(s => {
      s.items.forEach(i => {
        rows.push([s.id, s.datetime, s.cashier, i.name, i.qty, i.price, i.subtotal, s.total, s.amountPaid, s.change]);
      });
    });

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tindarhan-sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.toast('CSV exported.');
  },

  printReport() {
    window.print();
  },
};
