const express = require('express');
const path = require('path');
const store = require('../db/store');
const upload = require('../middleware/upload');
const aiService = require('../services/aiService');
const matcher = require('../services/matcher');
const { toApi } = require('../db/serialize');
const config = require('../config');
const auth = require('../auth');

const router = express.Router();

const VALID_TYPES = ['Lost', 'Found'];
const VALID_STATUS = ['Lost', 'Found', 'Recovered'];

function cleanPayload(body) {
  const type = String(body.type || '');
  const title = String(body.title || '').trim();
  const desc = String(body.desc || '').trim();
  const category = String(body.category || '').trim();
  const location = String(body.location || '').trim();
  const date = String(body.date || '').trim();
  const contact = String(body.contact || '').trim();
  const reporterName = String(body.reporterName || '').trim().slice(0, 120);

  const errors = [];
  if (!VALID_TYPES.includes(type)) errors.push('type must be Lost or Found');
  if (title.length < 3 || title.length > 200) errors.push('title must be 3-200 characters');
  if (desc.length < 3 || desc.length > 2000) errors.push('description must be 3-2000 characters');
  if (!category) errors.push('category is required');
  if (!location) errors.push('location is required');
  if (!contact) errors.push('contact is required');

  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }
  return { type, title, desc, category, location, date, contact, reporterName };
}

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    const data = cleanPayload(req.body);
    const image = req.file
      ? `/uploads/${req.file.filename}`
      : String(req.body.imageUrl || '').trim();

    const created = await store.createItem({
      ...data,
      image,
      status: data.type,
      detected: { available: false, labels: [] },
      embedding: { available: false, vector: [] },
      ai: { processed: false, extracted: {} }
    });

    const imagePath = req.file ? path.join(config.uploadDir, req.file.filename) : null;
    const enrich = await aiService.processItem(created, imagePath);
    const updated = await store.updateItem(created._id, enrich);

    const matches = matcher.matchItem(updated, await store.allItems())
      .slice(0, 4)
      .map(m => ({ ...matcher.summarize(m.other), score: m.score, reasons: m.reasons }));

    res.status(201).json({ item: toApi(updated), matches });
  } catch (e) {
    if (req.file) {
      try { require('fs').unlinkSync(path.join(config.uploadDir, req.file.filename)); } catch (_) { /* ignore */ }
    }
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const items = await store.listItems(req.query);
    res.json({ items: items.map(toApi) });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await store.getItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: toApi(item) });
  } catch (e) { next(e); }
});

router.get('/:id/matches', async (req, res, next) => {
  try {
    const item = await store.getItem(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const matches = matcher.matchItem(item, await store.allItems())
      .map(m => ({ ...matcher.summarize(m.other), score: m.score, reasons: m.reasons }));
    res.json({ matches });
  } catch (e) { next(e); }
});

router.patch('/:id/recover', auth.requireAdmin, async (req, res, next) => {
  try {
    const updated = await store.updateItem(req.params.id, { status: 'Recovered' });
    if (!updated) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: toApi(updated) });
  } catch (e) { next(e); }
});

router.delete('/:id', auth.requireAdmin, async (req, res, next) => {
  try {
    const ok = await store.deleteItem(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Item not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;