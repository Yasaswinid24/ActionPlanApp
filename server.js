const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Connection string from MongoDB Atlas. Set this in Render's Environment
// tab — see README.md. Because the data now lives in Atlas instead of on
// Render's local disk, it survives every redeploy automatically.
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'action_plans';

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Set it in your environment variables (see README.md).');
}

function newId() {
  return crypto.randomBytes(6).toString('hex');
}

let plansCollection;

async function connectDb() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  plansCollection = client.db(DB_NAME).collection('plans');
  console.log('Connected to MongoDB');
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
app.get('/api/plans', requireAdmin, async (req, res) => {
  const docs = await plansCollection.find({}).toArray();
  const list = docs.map(plan => ({
    id: plan._id,
    title: plan.title,
    createdAt: plan.createdAt,
    openCount: (plan.items || []).filter(i => !i.done).length,
    totalCount: (plan.items || []).length
  }));
  list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  res.json(list);
});

// Create a new plan (e.g. for a new prospect/customer)
app.post('/api/plans', requireAdmin, async (req, res) => {
  const id = newId();
  const doc = {
    _id: id,
    title: (req.body.title || 'Untitled plan').toString().slice(0, 200),
    items: [],
    createdAt: new Date().toISOString()
  };
  await plansCollection.insertOne(doc);
  res.json({ ok: true, id });
});

// Get one plan — open access via its unguessable ID (this is the customer link)
app.get('/api/plans/:id', async (req, res) => {
  const plan = await plansCollection.findOne({ _id: req.params.id });
  if (!plan) return res.status(404).json({ ok: false, error: 'Plan not found' });
  res.json({ id: plan._id, title: plan.title, items: plan.items, createdAt: plan.createdAt });
});

app.put('/api/plans/:id/title', async (req, res) => {
  const title = (req.body.title || 'Untitled plan').toString().slice(0, 200);
  const result = await plansCollection.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { title } },
    { returnDocument: 'after' }
  );
  if (!result) return res.status(404).json({ ok: false, error: 'Plan not found' });
  res.json({ ok: true, title });
});

async function saveItemsHandler(req, res) {
  if (!Array.isArray(req.body.items)) {
    return res.status(400).json({ ok: false, error: 'items must be an array' });
  }
  const result = await plansCollection.findOneAndUpdate(
    { _id: req.params.id },
    { $set: { items: req.body.items } },
    { returnDocument: 'after' }
  );
  if (!result) return res.status(404).json({ ok: false, error: 'Plan not found' });
  res.json({ ok: true });
}

app.put('/api/plans/:id/items', saveItemsHandler);
// navigator.sendBeacon() (used to flush an unsaved edit when the tab closes
// or the back button is pressed) can only send POST, not PUT — this route
// lets that reliable "save on the way out" mechanism work.
app.post('/api/plans/:id/items', saveItemsHandler);

app.delete('/api/plans/:id', requireAdmin, async (req, res) => {
  const result = await plansCollection.deleteOne({ _id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ ok: false, error: 'Plan not found' });
  res.json({ ok: true });
});

app.get('/healthz', (req, res) => res.send('ok'));

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Action plan server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });