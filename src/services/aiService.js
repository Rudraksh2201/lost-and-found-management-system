const config = require('../config');
const textExtractor = require('./textExtractor');
const detection = require('./detection');
const embedding = require('./embedding');

async function processItem(item, imagePath) {
  const extracted = textExtractor.extract(`${item.title} ${item.desc}`);

  let detected = { available: false, labels: [], error: null };
  if (config.detectionEnabled && imagePath) {
    detected = await detection.detect(imagePath);
  }

  let emb = { available: false, vector: [], model: 'clip-vit-base-patch32' };
  if (config.embeddingsEnabled && imagePath) {
    emb = await embedding.embed(imagePath);
  }

  return {
    ai: { processed: true, extracted, processedAt: new Date().toISOString() },
    detected,
    embedding: emb
  };
}

module.exports = { processItem };