function toApi(it) {
  if (!it) return it;
  const o = { ...it };
  delete o._id;
  delete o.__v;
  const emb = o.embedding || {};
  const det = o.detected || {};
  o.id = String(it._id ?? it.id ?? '');
  o.embedding = { available: !!emb.available, model: emb.model || null };
  o.detected = { available: !!det.available, labels: det.labels || [], error: det.error || null };
  if (o.ai) o.ai = { processed: !!o.ai.processed, extracted: o.ai.extracted || {}, processedAt: o.ai.processedAt || null };
  return o;
}

module.exports = { toApi };