let pipe = null;
let loadError = null;

async function getPipe() {
  if (pipe) return pipe;
  try {
    const { pipeline } = require('@xenova/transformers');
    pipe = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
    return pipe;
  } catch (e) {
    loadError = `CLIP unavailable: ${e.message}. To enable, run npm i @xenova/transformers.`;
    return null;
  }
}

async function embed(imagePath) {
  const p = await getPipe();
  if (!p) return { available: false, vector: [], error: loadError };
  try {
    const out = await p(imagePath, { pooling: 'mean', normalize: true });
    const vector = Array.from(out.data);
    return { available: true, vector, model: 'clip-vit-base-patch32', dim: vector.length };
  } catch (e) {
    return { available: false, vector: [], error: `Embedding failed: ${e.message}` };
  }
}

module.exports = { embed, status: () => ({ ready: !!pipe, error: loadError }) };