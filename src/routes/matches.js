const express = require('express');
const store = require('../db/store');
const matcher = require('../services/matcher');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await store.allItems();
    res.json({ pairs: matcher.allMatches(items) });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const item = await store.getItem(req.body.id || req.body._id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const matches = matcher.matchItem(item, await store.allItems())
      .map(m => ({ ...matcher.summarize(m.other), score: m.score, reasons: m.reasons }));
    res.json({ matches });
  } catch (e) { next(e); }
});

module.exports = router;