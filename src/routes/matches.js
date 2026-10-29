const express = require('express');
const store = require('../db/store');
const matcher = require('../services/matcher');
const textExtractor = require('../services/textExtractor');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const items = await store.allItems();
    res.json({ pairs: matcher.allMatches(items) });
  } catch (e) { next(e); }
});

router.post('/assist', async (req, res, next) => {
  try {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (query.length < 3 || query.length > 500) {
      return res.status(400).json({ error: 'Describe the item in 3 to 500 characters.' });
    }

    const extracted = textExtractor.extract(query);
    const lowered = query.toLowerCase();
    const lostIntent = /\b(lost|missing|misplaced|can't find|cannot find|lost my)\b/.test(lowered);
    const foundIntent = /\b(found|saw|seen|spotted|picked up)\b/.test(lowered);
    const intentTypes = lostIntent && !foundIntent ? ['Lost'] : foundIntent && !lostIntent ? ['Found'] : ['Lost', 'Found'];
    const categoryRules = [
      ['ID Card', /\b(id card|identity card|student card|badge)\b/],
      ['Electronics', /\b(phone|mobile|earbuds|headphones|laptop|charger|calculator|tablet|watch)\b/],
      ['Books', /\b(book|textbook|notebook|journal)\b/],
      ['Keys', /\b(keys|key|keychain)\b/],
      ['Wallet', /\b(wallet|purse)\b/]
    ];
    const category = categoryRules.find(([, pattern]) => pattern.test(lowered))?.[0] || '';
    const locationAliases = [
      ['Library', /\blibrary\b/], ['Canteen', /\b(canteen|mess|food court)\b/],
      ['Block A', /\b(block a|room a)\b/], ['Sports Complex', /\b(sports complex|ground|gym|basketball court)\b/],
      ['Hostel', /\b(hostel|dorm)\b/]
    ];
    const location = locationAliases.find(([, pattern]) => pattern.test(lowered))?.[0] || '';
    const explicitDate = lowered.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    const relativeDate = /\byesterday\b/.test(lowered)
      ? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      : /\btoday\b/.test(lowered) ? new Date().toISOString().slice(0, 10) : '';
    const allItems = await store.allItems();
    const candidates = [];

    for (const type of intentTypes) {
      const queryItem = {
        _id: `smart-find-${type}`,
        type,
        status: type,
        title: query.slice(0, 200),
        desc: query,
        category,
        location,
        date: explicitDate || relativeDate,
        ai: { extracted }
      };
      for (const match of matcher.matchItem(queryItem, allItems)) {
        candidates.push({ ...matcher.summarize(match.other), score: match.score, reasons: match.reasons });
      }
    }

    const seen = new Set();
    const results = candidates
      .sort((a, b) => b.score - a.score)
      .filter(item => !seen.has(item.id) && seen.add(item.id))
      .slice(0, 6);

    res.set('Cache-Control', 'no-store');
    res.json({
      results,
      intent: lostIntent && !foundIntent ? 'lost' : foundIntent && !lostIntent ? 'sighting' : 'both',
      extracted: { colors: extracted.colors, brands: extracted.brands, keywords: extracted.keywords },
      message: results.length ? `Found ${results.length} possible report match${results.length === 1 ? '' : 'es'}.` : 'No likely reports yet. Try adding a color, brand, category, or campus location.',
      mode: 'local-matching'
    });
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