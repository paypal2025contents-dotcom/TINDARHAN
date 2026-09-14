/**
 * main.js
 * App bootstrap: login gate, session check, tab navigation, clock,
 * and module initialization.
 */

let modulesInitialized = false;

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
  if (tabName === 'reports') Reports.render();
  if (tabName === 'inventory') Inventory.render();
}

function startClock() {
  const clockEl = document.getElementById('liveClock');
  const tick = () => {
    clockEl.textContent = new Date().toLocaleTimeString('en-PH', { hour12: true });
  };
  tick();
  setInterval(tick, 1000);
}

function initCashierPersistence() {
  const input = document.getElementById('cashierName');
  const settings = DB.getSettings();
  input.value = settings.cashier || '';
  input.addEventListener('change', () => {
    DB.saveSettings({ cashier: input.value.trim() }).catch(() => {
      UI.toast('Could not save cashier name.');
    });
  });
}

/* ============================================================
   Login / session handling
   ============================================================ */

function showLogin(message) {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appRoot').classList.add('hidden');
  const errorEl = document.getElementById('loginError');
  if (message) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  } else {
    errorEl.classList.add('hidden');
  }
}

async function showApp(username) {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appRoot').classList.remove('hidden');
  document.getElementById('loggedInUser').textContent = username || '';

  try {
    await DB.loadAll();
  } catch (err) {
    UI.toast('Could not load data from server.');
    return;
  }

  startClock();
  initCashierPersistence();

  if (!modulesInitialized) {
    POS.init();
    Inventory.init();
    Receipt.init();
    Reports.init();
    modulesInitialized = true;
  } else {
    POS.renderCategoryFilter();
    POS.renderItemGrid();
    POS.renderCart();
    Inventory.render();
    Reports.render();
  }
}

async function checkSession() {
  try {
    const res = await fetch('/api/session', { credentials: 'include' });
    const data = await res.json();
    return data;
  } catch (e) {
    return { loggedIn: false };
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showLogin(data.error || 'Invalid username or password.');
      return;
    }
    document.getElementById('loginForm').reset();
    await showApp(data.username);
  } catch (err) {
    showLogin('Could not reach the server. Please try again.');
  } finally {
    submitBtn.disabled = false;
  }
}

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } catch (e) { /* ignore */ }
  window.location.reload();
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  const session = await checkSession();
  if (session.loggedIn) {
    await showApp(session.username);
  } else {
    showLogin();
  }
});
