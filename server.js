/**
 * server.js
 * TinDARhan POS backend.
 *
 * - Serves the static frontend from /public
 * - Session-based login (default admin: ADMIN / ADMIN123)
 * - Stores items, sales, and settings in a JSON file on disk so that
 *   logging in from any device/browser sees the same shared data.
 *
 * For persistence across redeploys on Railway, attach a Volume and set
 * the DATA_FILE env var to a path inside it (see README.md).
 */

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');
const IS_PROD = !!process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';

/* ============================================================
   Data layer (simple JSON file — no external database required)
   ============================================================ */

function buildSeedItems() {
  const seed = [
    { name: 'Banana Chips', category: 'Chips & Snacks', icon: '🍌', price: 60, stock: 40, lowStockThreshold: 10 },
    { name: 'Rice Chips (Ampao)', category: 'Chips & Snacks', icon: '🍘', price: 55, stock: 35, lowStockThreshold: 10 },
    { name: 'Boiled Peanuts', category: 'Chips & Snacks', icon: '🥜', price: 45, stock: 30, lowStockThreshold: 8 },
    { name: 'Calamansi Juice Concentrate', category: 'Beverages', icon: '🍋', price: 90, stock: 25, lowStockThreshold: 5 },
    { name: 'Batangas Kapeng Barako', category: 'Beverages', icon: '☕', price: 150, stock: 20, lowStockThreshold: 5 },
    { name: 'Pure Honey (Bottle)', category: 'Preserves & Jams', icon: '🍯', price: 180, stock: 18, lowStockThreshold: 4 },
    { name: 'Turmeric Powder (Dilaw)', category: 'Condiments & Sauces', icon: '🧂', price: 70, stock: 22, lowStockThreshold: 5 },
    { name: 'Spiced Vinegar', category: 'Wine & Vinegar', icon: '🍶', price: 65, stock: 28, lowStockThreshold: 6 },
    { name: 'Batangas Lambanog', category: 'Wine & Vinegar', icon: '🍾', price: 220, stock: 15, lowStockThreshold: 3 },
    { name: 'Coco Jam (Minatamis)', category: 'Preserves & Jams', icon: '🥥', price: 95, stock: 20, lowStockThreshold: 5 },
    { name: 'Bagoong / Sardines Pack', category: 'Condiments & Sauces', icon: '🐟', price: 85, stock: 24, lowStockThreshold: 6 },
    { name: 'Woven Souvenir Item', category: 'Others', icon: '🧺', price: 120, stock: 12, lowStockThreshold: 3 },
  ];
  return seed.map((item, idx) => {
    const id = 'ITM' + String(idx + 1).padStart(4, '0');
    return { ...item, id, sku: id };
  });
}

function buildSeedData() {
  const items = buildSeedItems();
  return {
    users: [
      { username: 'ADMIN', passwordHash: bcrypt.hashSync('ADMIN123', 10) },
    ],
    items,
    sales: [],
    settings: { cashier: '' },
    seq: { item: items.length, sale: 0 },
  };
}

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(buildSeedData(), null, 2));
  }
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

ensureDataFile();

/* ============================================================
   Middleware
   ============================================================ */

app.set('trust proxy', IS_PROD ? 1 : 0);
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'tindarhan-pos-please-change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

/* ============================================================
   Auth routes
   ============================================================ */

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const data = readData();
  const user = data.users.find(
    u => u.username.toLowerCase() === String(username || '').toLowerCase()
  );
  if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  req.session.user = user.username;
  res.json({ ok: true, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  res.json({
    loggedIn: !!(req.session && req.session.user),
    username: req.session ? req.session.user : null,
  });
});

app.post('/api/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const data = readData();
  const user = data.users.find(u => u.username === req.session.user);
  if (!user || !bcrypt.compareSync(String(currentPassword || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }
  user.passwordHash = bcrypt.hashSync(String(newPassword), 10);
  writeData(data);
  res.json({ ok: true });
});

/* ============================================================
   State (everything the app needs on load)
   ============================================================ */

app.get('/api/state', requireAuth, (req, res) => {
  const data = readData();
  res.json({ items: data.items, sales: data.sales, settings: data.settings });
});

/* ============================================================
   Items
   ============================================================ */

app.post('/api/items', requireAuth, (req, res) => {
  const data = readData();
  data.seq.item += 1;
  const id = 'ITM' + String(data.seq.item).padStart(4, '0');
  const item = { ...req.body, id, sku: (req.body.sku && req.body.sku.trim()) || id };
  data.items.push(item);
  writeData(data);
  res.json(item);
});

app.put('/api/items/:id', requireAuth, (req, res) => {
  const data = readData();
  const idx = data.items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });
  data.items[idx] = { ...data.items[idx], ...req.body, id: req.params.id };
  writeData(data);
  res.json(data.items[idx]);
});

app.delete('/api/items/:id', requireAuth, (req, res) => {
  const data = readData();
  data.items = data.items.filter(i => i.id !== req.params.id);
  writeData(data);
  res.json({ ok: true });
});

/* ============================================================
   Sales (stock is validated & deducted server-side)
   ============================================================ */

app.post('/api/sales', requireAuth, (req, res) => {
  const data = readData();
  const sale = req.body || {};

  if (!Array.isArray(sale.items) || sale.items.length === 0) {
    return res.status(400).json({ error: 'Sale has no items' });
  }

  for (const line of sale.items) {
    const item = data.items.find(i => i.id === line.id);
    if (!item || item.stock < line.qty) {
      return res.status(400).json({ error: `Not enough stock for ${line.name || line.id}` });
    }
  }

  sale.items.forEach(line => {
    const item = data.items.find(i => i.id === line.id);
    item.stock -= line.qty;
  });

  data.seq.sale += 1;
  sale.id = 'SALE' + String(data.seq.sale).padStart(5, '0');
  data.sales.push(sale);
  writeData(data);

  res.json({ sale, items: data.items });
});

/* ============================================================
   Settings
   ============================================================ */

app.put('/api/settings', requireAuth, (req, res) => {
  const data = readData();
  data.settings = { ...data.settings, ...req.body };
  writeData(data);
  res.json(data.settings);
});

/* ============================================================
   Static frontend
   ============================================================ */

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`TinDARhan POS server running on port ${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
