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

// --- Admin protection (you + Panos only) ---
// Protects: the customer list page, listing/creating/deleting plans.
// NOT protected: an individual plan's own link (/plan.html?id=... and its
// GET/PUT endpoints) — that's the link that's safe to share with a customer,
// since plan IDs are random 12-character codes and there's no way to
// discover other IDs without admin access.
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

function requireAdmin(req, res, next) {
  if (!ADMIN_PASSWORD) {
    // No password configured yet — fail safe by blocking access rather than
    // leaving the customer list open. Set ADMIN_PASSWORD in Render's
    // environment variables to enable access. See README.md.
    return res.status(503).send('Admin access is not configured yet. Set ADMIN_PASSWORD in your environment variables.');
  }
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    if (user === ADMIN_USER && pass === ADMIN_PASSWORD) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="Action Plans"');
  return res.status(401).send('Authentication required.');
}

app.use(express.json());

// Serve plan.html, plan API, and static assets (css/fonts/etc) without a
// password — this is the part safe to share with a customer.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.get('/plan.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'plan.html'));
});

// The customer list page itself requires the admin password.
app.get('/', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- API ---

// List all plans (summary only, for the customer/prospect list page)
app.get('/api/plans', requireAdmin, (req, res) => {
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
app.post('/api/plans', requireAdmin, (req, res) => {
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

// Get one plan — open access via its unguessable ID (this is the customer link)
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

function saveItemsHandler(req, res) {
  if (!Array.isArray(req.body.items)) {
    return res.status(400).json({ ok: false, error: 'items must be an array' });
  }
  const db = readDb();
  const plan = db.plans[req.params.id];
  if (!plan) return res.status(404).json({ ok: false, error: 'Plan not found' });
  plan.items = req.body.items;
  writeDb(db);
  res.json({ ok: true });
}

app.put('/api/plans/:id/items', saveItemsHandler);
// navigator.sendBeacon() (used to flush an unsaved edit when the tab closes
// or the back button is pressed) can only send POST, not PUT — this route
// lets that reliable "save on the way out" mechanism work.
app.post('/api/plans/:id/items', saveItemsHandler);

app.delete('/api/plans/:id', requireAdmin, (req, res) => {
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