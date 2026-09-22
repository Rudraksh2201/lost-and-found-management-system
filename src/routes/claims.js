const express = require('express');
const store = require('../db/store');
const auth = require('../auth');

const router = express.Router();

function serialize(c, itemTitle = '') {
  const o = { ...c };
  delete o._id;
  delete o.__v;
  o.id = String(c._id ?? c.id ?? '');
  o.itemTitle = itemTitle;
  return o;
}

function cleanClaim(body) {
  const itemId = String(body.itemId || '').trim();
  const claimantName = String(body.claimantName || '').trim();
  const claimantEmail = String(body.claimantEmail || '').trim();
  const note = String(body.note || '').trim();
  if (!itemId || claimantName.length < 2 || !claimantEmail.includes('@')) {
    const err = new Error('itemId, claimantName and a valid claimantEmail are required');
    err.status = 400;
    throw err;
  }
  return { itemId, claimantName, claimantEmail, note: note.slice(0, 1000), status: 'pending' };
}

router.get('/', auth.requireAdmin, async (req, res, next) => {
  try {
    const claims = await store.listClaims();
    const items = await store.allItems();
    const byId = new Map(items.map(i => [String(i._id), i]));
    const out = claims.map(c => ({
      ...serialize(c),
      itemTitle: byId.get(String(c.itemId))?.title || '(deleted item)'
    }));
    res.json({ claims: out });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = cleanClaim(req.body);
    const item = await store.getItem(data.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status === 'Recovered') return res.status(400).json({ error: 'Item already recovered' });
    const claim = await store.createClaim(data);
    res.status(201).json({ claim: serialize(claim, item.title) });
  } catch (e) { next(e); }
});

router.patch('/:id', auth.requireAdmin, async (req, res, next) => {
  try {
    const action = String(req.body.action || '');
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve or reject' });
    }
    const claim = await store.getClaim ? await store.getClaim(req.params.id) : (await store.listClaims()).find(c => String(c._id) === String(req.params.id));
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    const status = action === 'approve' ? 'approved' : 'rejected';
    const updated = await store.updateClaim(claim._id, { status });
    if (action === 'approve') {
      await store.updateItem(claim.itemId, { status: 'Recovered' });
    }
    res.json({ claim: serialize(updated) });
  } catch (e) { next(e); }
});

module.exports = router;