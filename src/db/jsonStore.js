const fs = require('fs');
const path = require('path');
const config = require('../config');
const { sampleItems } = require('./sampleData');

let db = { items: [], claims: [] };
let nextId = 1;

function load() {
  if (fs.existsSync(config.dbFile)) {
    const parsed = JSON.parse(fs.readFileSync(config.dbFile, 'utf8'));
    db.items = parsed.items || [];
    db.claims = parsed.claims || [];
  } else {
    db = { items: [], claims: [] };
  }
  nextId = db.items.reduce((m, i) => Math.max(m, parseInt(String(i._id), 10) || 0), 0) + 1;
}

function persist() {
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
  fs.writeFileSync(config.dbFile, JSON.stringify(db, null, 2));
}

async function init() {
  load();
  if (db.items.length === 0) {
    const now = new Date().toISOString();
    db.items = sampleItems().map(s => ({
      _id: String(nextId++), ...s, createdAt: now, updatedAt: now
    }));
    persist();
  }
}

function allItems() { return db.items; }

async function listItems(f) {
  let out = [...db.items];
  const s = (f.search || '').toLowerCase();
  if (s) out = out.filter(i => i.title.toLowerCase().includes(s) || i.desc.toLowerCase().includes(s));
  if (f.category && f.category !== 'All') out = out.filter(i => i.category === f.category);
  if (f.location && f.location !== 'All') out = out.filter(i => i.location === f.location);
  if (f.status && f.status !== 'All') out = out.filter(i => i.status === f.status);
  if (f.type && f.type !== 'All') out = out.filter(i => i.type === f.type);
  return out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 200);
}

async function getItem(id) {
  return db.items.find(i => String(i._id) === String(id)) || null;
}

async function createItem(data) {
  const now = new Date().toISOString();
  const item = { _id: String(nextId++), ...data, createdAt: now, updatedAt: now };
  db.items.unshift(item);
  persist();
  return item;
}

async function updateItem(id, patch) {
  const item = db.items.find(i => String(i._id) === String(id));
  if (!item) return null;
  Object.assign(item, patch, { updatedAt: new Date().toISOString() });
  persist();
  return item;
}

async function deleteItem(id) {
  const before = db.items.length;
  db.items = db.items.filter(i => String(i._id) !== String(id));
  if (db.items.length !== before) {
    db.claims = db.claims.filter(c => String(c.itemId) !== String(id));
    persist();
    return true;
  }
  return false;
}

async function listClaims() { return [...db.claims]; }

async function createClaim(data) {
  const now = new Date().toISOString();
  const claim = { _id: String(nextId++), ...data, createdAt: now, updatedAt: now };
  db.claims.unshift(claim);
  persist();
  return claim;
}

async function updateClaim(id, patch) {
  const claim = db.claims.find(c => String(c._id) === String(id));
  if (!claim) return null;
  Object.assign(claim, patch, { updatedAt: new Date().toISOString() });
  persist();
  return claim;
}

async function stats() {
  let lost = 0, found = 0, recovered = 0;
  for (const i of db.items) {
    if (i.status === 'Recovered') recovered++;
    else if (i.type === 'Lost') lost++;
    else if (i.type === 'Found') found++;
  }
  return { lost, found, recovered, total: db.items.length, pendingClaims: db.claims.filter(c => c.status === 'pending').length };
}

module.exports = { init, allItems, listItems, getItem, createItem, updateItem, deleteItem, listClaims, createClaim, updateClaim, stats };