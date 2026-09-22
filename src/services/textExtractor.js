const STOPWORDS = new Set([
  'the','and','for','with','near','was','has','having','this','that','from','its','into',
  'around','about','found','lost','item','report','your','you','are','not','had','been',
  'some','very','there','were','will','than','then','they','them','their'
]);

const COLORS = ['black','white','blue','red','green','yellow','brown','grey','gray','orange',
  'pink','purple','silver','gold','maroon','navy','beige','cream','teal'];

const BRANDS = ['boat','boAt','samsung','apple','oneplus','casio','honda','sony','dell','lenovo',
  'nike','adidas','puma','fastrack','titan','noise','realme','xiaomi','redmi','anker','jbl',
  'wildcraft','american tourister','skybags','wildhorn','asus','acer','canon','nikon','logitech',
  'skullcandy','hp'];

const FLAGS = ['sticker','keychain','scratch','worn','logo','tag','case','engraved','stitching',
  'stitch','label','handwritten','charm','stain','zip','pouch'];

const LOC_KEYS = [
  ['library', ['library']],
  ['canteen', ['canteen', 'food court', 'mess hall', 'counter']],
  ['block a', ['block a', 'room a-']],
  ['sports complex', ['sports complex', 'ground', 'basketball', 'court', 'gym']],
  ['hostel', ['hostel', 'dorm', 'warden']]
];

const WEEKDAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);

function keywords(text) {
  const words = new Set();
  (text || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).forEach(w => {
    if (w.length > 2 && !STOPWORDS.has(w)) words.add(w);
  });
  return [...words].slice(0, 20);
}

function extract(text) {
  const t = String(text || '').toLowerCase();
  const colors = COLORS.filter(c => new RegExp(`\\b${c}\\b`).test(t));
  const brands = BRANDS.filter(b => t.includes(b.toLowerCase()));
  const features = FLAGS.filter(f => t.includes(f));
  const locHints = LOC_KEYS.filter(([, keys]) => keys.some(k => t.includes(k))).map(([k]) => k);
  const dayHints = WEEKDAYS.size ? [...WEEKDAYS].filter(d => t.includes(d)).map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)) : [];
  const kw = keywords(text).filter(w => !colors.includes(w) && !brands.includes(w));
  return {
    colors: [...new Set(colors)],
    brands: [...new Set(brands)],
    features: [...new Set(features)],
    locHints,
    dayHints,
    keywords: [...new Set(kw)].slice(0, 12),
    count: kw.length
  };
}

module.exports = { extract, keywords };