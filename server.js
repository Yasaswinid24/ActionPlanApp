const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// Data now lives in MongoDB Atlas (free tier), NOT on Render's disk.
// This means it survives restarts, redeploys, and sleep/wake cycles.
// You must set the MONGODB_URI environment variable in Render's dashboard
// (Settings -> Environment) with your Atlas connection string.
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'action_plan';

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI environment variable. Set it in Render -> Environment.');
  process.exit(1);
}

const client = new MongoClient(MONGODB_URI);
let plansCollection;

const DEFAULT_DOC = { _id: 'plan', title: 'Untitled plan', items: [] };

async function initDb() {
  await client.connect();
  const db = client.db(DB_NAME);
  plansCollection = db.collection('plans');
  const existing = await plansCollection.findOne({ _id: 'plan' });
  if (!existing) {
    await plansCollection.insertOne(DEFAULT_DOC);
  }
  console.log('Connected to MongoDB Atlas.');
}

async function readDb() {
  const doc = await plansCollection.findOne({ _id: 'plan' });
  return doc || DEFAULT_DOC;
}

async function writeDb(update) {
  await plansCollection.updateOne({ _id: 'plan' }, { $set: update }, { upsert: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API ---

app.get('/api/plan', async (req, res) => {
  res.json(await readDb());
});

app.put('/api/plan/title', async (req, res) => {
  const title = (req.body.title || 'Untitled plan').toString().slice(0, 200);
  await writeDb({ title });
  res.json({ ok: true, title });
});

app.put('/api/plan/items', async (req, res) => {
  if (!Array.isArray(req.body.items)) {
    return res.status(400).json({ ok: false, error: 'items must be an array' });
  }
  await writeDb({ items: req.body.items });
  res.json({ ok: true });
});

app.get('/healthz', (req, res) => res.send('ok'));

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Action plan server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB Atlas:', err);
    process.exit(1);
  });
