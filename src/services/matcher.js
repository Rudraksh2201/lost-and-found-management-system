const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'near', 'was', 'has', 'having', 'this', 'that', 'from', 'its',
  'around', 'about', 'found', 'lost', 'item', 'report', 'your', 'are', 'not', 'had', 'been',
  'some', 'very', 'there', 'were', 'will', 'than', 'then', 'they', 'them', 'their'
]);

const CATKEY = {
  'id card': ['id', 'card', 'identity', 'badge'],
  'electronics': ['phone', 'earbuds', 'calculator', 'laptop', 'charger', 'headphones', 'cable', 'macbook'],
  'books': ['book', 'textbook', 'novel', 'notebook', 'journal'],
  'keys': ['key', 'keychain', 'keys'],
  'wallet': ['wallet', 'purse', 'money', 'cash'],
  'others': []
};

const LOCMAP = {
  'library': 'library',
  'canteen': 'canteen',
  'food court': 'canteen',
  'mess': 'canteen',
  'block a': 'blocka',
  'sports complex': 'sports',
  'ground': 'sports',
  'gym': 'sports',
  'hostel': 'hostel',
  'dorm': 'hostel'
};

function tokenSet(...strs) {
  const s = new Set();
  for (const str of strs) {
    String(str || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).forEach(w => {
      if (w.length > 2 && !STOPWORDS.has(w)) s.add(w);
    });
  }
  return s;
}

function jaccard(A, B) {
  if (!A.size || !B.size) return null;
  let inter = 0;
  A.forEach(w => { if (B.has(w)) inter++; });
  return inter / (A.size + B.size - inter);
}

function categorySim(c1, c2) {
  if (c1 === c2) return 1;
  const k1 = CATKEY[String(c1 || '').toLowerCase()] || [];
  const k2 = CATKEY[String(c2 || '').toLowerCase()] || [];
  if (k1.length && k2.length && k1.some(w => k2.includes(w))) return 0.6;
  return 0;
}

function locationSim(l1, l2) {
  if (l1 === l2) return 1;
  const g1 = LOCMAP[String(l1 || '').toLowerCase()];
  const g2 = LOCMAP[String(l2 || '').toLowerCase()];
  if (g1 && g2 && g1 === g2) return 0.6;
  return 0;
}

function dateSim(d1, d2) {
  if (!d1 || !d2) return null;
  const a = Date.parse(d1), b = Date.parse(d2);
  if (isNaN(a) || isNaN(b)) return null;
  const diff = Math.abs(a - b) / 86400000;
  return Math.max(0, 1 - Math.min(diff, 30) / 30);
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length || !a.length) return null;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  if (!den) return null;
  return Math.max(0, Math.min(1, dot / den));
}

function objectSim(a, b) {
  const labelsOf = it => {
    const d = it.detected;
    if (d && d.available && Array.isArray(d.labels)) {
      return d.labels.filter(l => l.confidence >= 0.4).map(l => l.label);
    }
    return [];
  };
  const la = labelsOf(a), lb = labelsOf(b);
  if (la.length && lb.length) {
    const A = new Set(la), B = new Set(lb);
    let inter = 0;
    A.forEach(w => { if (B.has(w)) inter++; });
    return inter / new Set([...la, ...lb]).size || 0;
  }
  const ka = (a.ai && a.ai.extracted && a.ai.extracted.keywords) || [];
  const kb = (b.ai && b.ai.extracted && b.ai.extracted.keywords) || [];
  if (ka.length && kb.length) {
    const A = new Set(ka), B = new Set(kb);
    let inter = 0;
    A.forEach(w => { if (B.has(w)) inter++; });
    return inter / new Set([...ka, ...kb]).size || 0;
  }
  return null;
}

function imageSim(a, b) {
  const av = (a.embedding && a.embedding.available && a.embedding.vector) || [];
  const bv = (b.embedding && b.embedding.available && b.embedding.vector) || [];
  return cosineSim(av, bv);
}

function textSim(a, b) {
  return jaccard(tokenSet(a.title, a.desc), tokenSet(b.title, b.desc));
}

const WEIGHTS = { category: 30, text: 25, location: 15, date: 10, object: 10, image: 10 };

function computeSignals(a, b) {
  const signals = [];
  signals.push({ key: 'category', weight: WEIGHTS.category, value: categorySim(a.category, b.category), reason: 'Category' });
  const txt = textSim(a, b);
  if (txt !== null) signals.push({ key: 'text', weight: WEIGHTS.text, value: txt, reason: 'Description keywords' });
  signals.push({ key: 'location', weight: WEIGHTS.location, value: locationSim(a.location, b.location), reason: 'Location' });
  const dt = dateSim(a.date, b.date);
  if (dt !== null) signals.push({ key: 'date', weight: WEIGHTS.date, value: dt, reason: 'Date proximity' });
  const obj = objectSim(a, b);
  if (obj !== null) signals.push({ key: 'object', weight: WEIGHTS.object, value: obj, reason: 'Detected object' });
  const img = imageSim(a, b);
  if (img !== null) signals.push({ key: 'image', weight: WEIGHTS.image, value: img, reason: 'Image similarity' });
  return signals;
}

function scorePair(a, b) {
  const signals = computeSignals(a, b);
  const wsum = signals.reduce((s, x) => s + x.weight, 0);
  if (!wsum) return { score: 0, signals: [] };
  const score = Math.round((100 * signals.reduce((s, x) => s + x.weight * x.value, 0)) / wsum);
  return { score: Math.max(0, Math.min(100, score)), signals };
}

function reasonsFor(signals, score) {
  const list = signals.filter(s => s.value >= 0.2).map(s => `${s.reason} (${Math.round(s.value * 100)}%)`);
  if (!list.length && score > 0) list.push(`Weak overlap (${score}%)`);
  list.push(`Scoring signals: ${signals.map(s => s.key).join(', ')}`);
  return list;
}

function summarize(it) {
  return {
    id: String(it._id),
    title: it.title,
    type: it.type,
    status: it.status,
    category: it.category,
    location: it.location,
    date: it.date,
    image: it.image
  };
}

function matchItem(item, all) {
  const opp = item.type === 'Lost' ? 'Found' : 'Lost';
  const out = [];
  for (const other of all) {
    if (String(other._id) === String(item._id)) continue;
    if (other.status === 'Recovered' || item.status === 'Recovered') continue;
    if (other.type !== opp) continue;
    const { score, signals } = scorePair(item, other);
    if (score <= 0) continue;
    out.push({ other, score, signals, reasons: reasonsFor(signals, score) });
  }
  return out.sort((a, b) => b.score - a.score);
}

function allMatches(all) {
  const lost = all.filter(i => i.type === 'Lost' && i.status !== 'Recovered');
  const found = all.filter(i => i.type === 'Found' && i.status !== 'Recovered');
  const out = [];
  for (const l of lost) {
    for (const f of found) {
      const { score, signals } = scorePair(l, f);
      if (score >= 45) out.push({ lost: summarize(l), found: summarize(f), score, reasons: reasonsFor(signals, score) });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

module.exports = { matchItem, allMatches, summarize, computeSignals };