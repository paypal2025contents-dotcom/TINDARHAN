/**
 * receipt.js
 * Builds and prints the sale receipt.
 */

const Receipt = {
  init() {
    document.getElementById('closeReceiptBtn').addEventListener('click', () => UI.closeModal('receiptModal'));
    document.getElementById('printReceiptBtn').addEventListener('click', () => this.print());
  },

  show(sale) {
    const content = document.getElementById('receiptContent');
    content.innerHTML = `
      <div class="r-center">
        <div class="r-title">TinDARhan</div>
        <div class="r-sub">Gawang ARBO, Produktong Batangue&ntilde;o</div>
        <div class="r-sub">DAR Batangas &bull; PMS Bldg., Maraouy, Lipa City</div>
      </div>
      <hr>
      <div class="r-line"><span>Receipt No.</span><span>${sale.id}</span></div>
      <div class="r-line"><span>Date</span><span>${UI.formatDateTime(sale.datetime)}</span></div>
      <div class="r-line"><span>Cashier</span><span>${UI.escapeHtml(sale.cashier)}</span></div>
      <hr>
      ${sale.items.map(i => `
        <div class="r-line">
          <span class="r-item-name">${UI.escapeHtml(i.name)} x${i.qty}</span>
          <span>${UI.peso(i.subtotal)}</span>
        </div>
      `).join('')}
      <hr>
      <div class="r-line r-total"><span>TOTAL</span><span>${UI.peso(sale.total)}</span></div>
      <div class="r-line"><span>Amount Paid</span><span>${UI.peso(sale.amountPaid)}</span></div>
      <div class="r-line"><span>Change</span><span>${UI.peso(sale.change)}</span></div>
      <div class="r-footer">
        Salamat po sa inyong pagsuporta!<br>
        Thank you for supporting our ARBO farmers.
      </div>
    `;
    UI.openModal('receiptModal');
  },

  print() {
    const modal = document.getElementById('receiptModal');
    modal.classList.add('printing');
    window.print();
    setTimeout(() => modal.classList.remove('printing'), 300);
  },
};
