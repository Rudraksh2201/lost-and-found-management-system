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
  const itemId = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
  const claimantName = typeof body?.claimantName === 'string' ? body.claimantName.trim() : '';
  const claimantEmail = typeof body?.claimantEmail === 'string' ? body.claimantEmail.trim() : '';
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  const emailValid = claimantEmail.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claimantEmail);
  if (!itemId || itemId.length > 64 || claimantName.length < 2 || claimantName.length > 120 || !emailValid || note.length > 1000) {
    const err = new Error('itemId, claimantName and a valid claimantEmail are required');
    err.status = 400;
    throw err;
  }
  return { itemId, claimantName, claimantEmail, note, status: 'pending' };
}

router.get('/', auth.requireAdmin, async (req, res, next) => {
  try {
    const claims = await store.listClaims();
    const items = await store.allItems();
    const byId = new Map(items.map(i => [String(i._id), i]));
    const out = claims.map(c => {
      const item = byId.get(String(c.itemId));
      return {
        ...serialize(c),
        kind: c.kind || (item?.type === 'Lost' ? 'sighting' : 'ownership'),
        itemTitle: item?.title || '(deleted item)'
      };
    });
    res.json({ claims: out });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const data = cleanClaim(req.body);
    const item = await store.getItem(data.itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.status === 'Recovered') return res.status(400).json({ error: 'Item already recovered' });
    data.kind = item.type === 'Found' ? 'ownership' : 'sighting';
    const claim = await store.createClaim(data);
    res.status(201).json({ claim: serialize(claim, item.title) });
  } catch (e) { next(e); }
});

router.patch('/:id', auth.requireAdmin, async (req, res, next) => {
  try {
    const action = typeof req.body?.action === 'string' ? req.body.action : '';
    if (!['approve', 'reject', 'acknowledge'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve, reject or acknowledge' });
    }
    const claim = await store.getClaim(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending requests can be reviewed' });
    }

    const item = await store.getItem(claim.itemId);
    const kind = claim.kind || (item?.type === 'Lost' ? 'sighting' : 'ownership');
    if (kind === 'sighting' && action === 'approve') {
      return res.status(400).json({ error: 'Sighting reports must be acknowledged, not approved as ownership claims' });
    }
    if (kind === 'ownership' && action === 'acknowledge') {
      return res.status(400).json({ error: 'Ownership claims must be approved or rejected' });
    }

    if (action === 'approve') {
      if (!item) return res.status(404).json({ error: 'Claimed item no longer exists' });
      if (item.status === 'Recovered') {
        return res.status(409).json({ error: 'Item has already been recovered' });
      }
      const recovered = await store.updateItem(claim.itemId, { status: 'Recovered' });
      if (!recovered) return res.status(409).json({ error: 'Item could not be recovered' });
    }

    const status = action === 'approve' ? 'approved' : action === 'acknowledge' ? 'acknowledged' : 'rejected';
    const updated = await store.updateClaim(claim._id, { status });
    if (!updated) return res.status(404).json({ error: 'Claim not found' });
    res.json({ claim: serialize(updated) });
  } catch (e) { next(e); }
});

module.exports = router;