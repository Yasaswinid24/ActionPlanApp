const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Data lives on disk. On Render's FREE plan this folder is wiped on every
// new deploy (and possibly on restarts) unless you attach a paid Persistent
// Disk mounted at /data. See README.md for details.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ title: 'Untitled plan', items: [] }, null, 2));
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

app.get('/api/plan', (req, res) => {
  res.json(readDb());
});

app.put('/api/plan/title', (req, res) => {
  const db = readDb();
  db.title = (req.body.title || 'Untitled plan').toString().slice(0, 200);
  writeDb(db);
  res.json({ ok: true, title: db.title });
});

app.put('/api/plan/items', (req, res) => {
  if (!Array.isArray(req.body.items)) {
    return res.status(400).json({ ok: false, error: 'items must be an array' });
  }
  const db = readDb();
  db.items = req.body.items;
  writeDb(db);
  res.json({ ok: true });
});

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, () => {
  console.log(`Action plan server running on port ${PORT}`);
});
