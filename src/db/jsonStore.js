const fs = require('fs');
const path = require('path');
const config = require('../config');
const { sampleItems } = require('./sampleData');

let db = { items: [], claims: [] };
let nextId = 1;

function load() {
  if (!fs.existsSync(config.dbFile)) {
    db = { items: [], claims: [] };
    nextId = 1;
    return false;
  }

  const parsed = JSON.parse(fs.readFileSync(config.dbFile, 'utf8'));
  if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.claims)) {
    throw new Error(`Invalid JSON store format at ${config.dbFile}`);
  }
  db = parsed;
  nextId = [...db.items, ...db.claims].reduce((max, row) => {
    return Math.max(max, parseInt(String(row._id), 10) || 0);
  }, 0) + 1;
  return true;
}

function persist() {
  fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
  const tempFile = `${config.dbFile}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), { mode: 0o600 });
    fs.renameSync(tempFile, config.dbFile);
  } catch (error) {
    try { fs.unlinkSync(tempFile); } catch (_) { /* best-effort temp cleanup */ }
    throw error;
  }
}

async function init() {
  const storeExists = load();
  if (!storeExists) {
    const now = new Date().toISOString();
    db.items = sampleItems().map(s => ({
      _id: String(nextId++), ...s, createdAt: now, updatedAt: now
    }));
    persist();
  }
}

function allItems() { return db.items; }

async function listItems(f = {}) {
  let out = [...db.items];
  const value = key => typeof f[key] === 'string' ? f[key].trim() : '';
  const s = value('search').toLowerCase().slice(0, 100);
  if (s) out = out.filter(i => String(i.title || '').toLowerCase().includes(s) || String(i.desc || '').toLowerCase().includes(s));
  const category = value('category');
  const location = value('location');
  const status = value('status');
  const type = value('type');
  if (category && category !== 'All') out = out.filter(i => i.category === category);
  if (location && location !== 'All') out = out.filter(i => i.location === location);
  if (status && status !== 'All') out = out.filter(i => i.status === status);
  if (type && type !== 'All') out = out.filter(i => i.type === type);
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

async function getClaim(id) {
  return db.claims.find(c => String(c._id) === String(id)) || null;
}

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

module.exports = { init, allItems, listItems, getItem, createItem, updateItem, deleteItem, listClaims, getClaim, createClaim, updateClaim, stats };