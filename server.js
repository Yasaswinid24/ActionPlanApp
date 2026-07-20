const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Data lives on disk. On Render's FREE plan this folder is wiped on every
// new deploy (and possibly on restarts) unless you attach a paid Persistent
// Disk mounted at /data. See README.md for details.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function newId() {
  return crypto.randomBytes(6).toString('hex');
}

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ plans: {} }, null, 2));
    return;
  }
  // Migrate old single-plan format ({ title, items }) into the new
  // multi-plan format ({ plans: { id: { title, items } } }) automatically.
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!raw.plans) {
    const migrated = { plans: {} };
    if (raw.title || raw.items) {
      const id = newId();
      migrated.plans[id] = {
        title: raw.title || 'Untitled plan',
        items: raw.items || [],
        createdAt: new Date().toISOString()
      };
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(migrated, null, 2));
  }
}
ensureDb();

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ---

// List all plans (summary only, for the customer/prospect list page)
app.get('/api/plans', (req, res) => {
  const db = readDb();
  const list = Object.entries(db.plans).map(([id, plan]) => ({
    id,
    title: plan.title,
    createdAt: plan.createdAt,
    openCount: (plan.items || []).filter(i => !i.done).length,
    totalCount: (plan.items || []).length
  }));
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(list);
});

// Create a new plan (e.g. for a new prospect/customer)
app.post('/api/plans', (req, res) => {
  const db = readDb();
  const id = newId();
  db.plans[id] = {
    title: (req.body.title || 'Untitled plan').toString().slice(0, 200),
    items: [],
    createdAt: new Date().toISOString()
  };
  writeDb(db);
  res.json({ ok: true, id });
});

// Get one plan
app.get('/api/plans/:id', (req, res) => {
  const db = readDb();
  const plan = db.plans[req.params.id];
  if (!plan) return res.status(404).json({ ok: false, error: 'Plan not found' });
  res.json({ id: req.params.id, ...plan });
});

app.put('/api/plans/:id/title', (req, res) => {
  const db = readDb();
  const plan = db.plans[req.params.id];
  if (!plan) return res.status(404).json({ ok: false, error: 'Plan not found' });
  plan.title = (req.body.title || 'Untitled plan').toString().slice(0, 200);
  writeDb(db);
  res.json({ ok: true, title: plan.title });
});

app.put('/api/plans/:id/items', (req, res) => {
  if (!Array.isArray(req.body.items)) {
    return res.status(400).json({ ok: false, error: 'items must be an array' });
  }
  const db = readDb();
  const plan = db.plans[req.params.id];
  if (!plan) return res.status(404).json({ ok: false, error: 'Plan not found' });
  plan.items = req.body.items;
  writeDb(db);
  res.json({ ok: true });
});

app.delete('/api/plans/:id', (req, res) => {
  const db = readDb();
  if (!db.plans[req.params.id]) return res.status(404).json({ ok: false, error: 'Plan not found' });
  delete db.plans[req.params.id];
  writeDb(db);
  res.json({ ok: true });
});

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`Action plan server running on port ${PORT}`);
});
