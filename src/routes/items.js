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
function cleanPayload(body) {
  const value = key => typeof body?.[key] === 'string' ? body[key].trim() : '';
  const type = value('type');
  const title = value('title');
  const desc = value('desc');
  const category = value('category');
  const location = value('location');
  const date = value('date');
  const contact = value('contact');
  const reporterName = value('reporterName');
  const imageUrl = value('imageUrl');

  const errors = [];
  if (!VALID_TYPES.includes(type)) errors.push('type must be Lost or Found');
  if (title.length < 3 || title.length > 200) errors.push('title must be 3-200 characters');
  if (desc.length < 3 || desc.length > 2000) errors.push('description must be 3-2000 characters');
  if (!category || category.length > 80) errors.push('category is required and must be at most 80 characters');
  if (!location || location.length > 160) errors.push('location is required and must be at most 160 characters');
  if (!contact || contact.length > 254) errors.push('contact is required and must be at most 254 characters');
  if (reporterName.length > 120) errors.push('reporter name must be at most 120 characters');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('date must use YYYY-MM-DD format');
  if (date && !Number.isFinite(Date.parse(`${date}T00:00:00Z`))) errors.push('date must be a valid calendar date');
  if (imageUrl && (imageUrl.length > 2048 || !/^https?:\/\//i.test(imageUrl))) errors.push('image URL must be a valid HTTP(S) URL under 2048 characters');

  if (errors.length) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }
  return { type, title, desc, category, location, date, contact, reporterName, imageUrl };
}

router.post('/', upload.single('image'), upload.validateImage, async (req, res, next) => {
  try {
    const data = cleanPayload(req.body);
    if (req.file && data.imageUrl) {
      return res.status(400).json({ error: 'Upload an image file or provide an image URL, not both.' });
    }
    const image = req.file ? `/uploads/${req.file.filename}` : data.imageUrl;

    const { imageUrl, ...itemData } = data;
    const created = await store.createItem({
      ...itemData,
      image,
      status: data.type,
      detected: { available: false, labels: [] },
      embedding: { available: false, vector: [] },
      ai: { processed: false, extracted: {} }
    });

    const imagePath = req.file ? path.join(config.uploadDir, req.file.filename) : null;
    const enrich = await aiService.processItem(created, imagePath);
    const updated = await store.updateItem(created._id, enrich);
    if (!updated) throw new Error('Item was created but could not be updated with AI results');

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
    const items = await store.listItems({
      search: req.query.search,
      category: req.query.category,
      location: req.query.location,
      status: req.query.status,
      type: req.query.type
    });
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