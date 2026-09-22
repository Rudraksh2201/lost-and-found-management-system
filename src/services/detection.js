const path = require('path');
const fs = require('fs');
const config = require('../config');

let rt = null;
let model = null;
let loadError = null;
const yolo = require('./yolo');

async function load() {
  if (rt) return true;
  const modelPath = path.resolve(config.detectionModel);
  if (!fs.existsSync(modelPath)) {
    loadError = `YOLO model not found at ${modelPath}. Drop a yolov8n.onnx file there (and npm i onnxruntime-node) to enable real detection.`;
    return false;
  }
  try {
    rt = require('onnxruntime-node');
    model = await yolo.load(modelPath);
    return true;
  } catch (e) {
    loadError = `Detector unavailable: ${e.message}`;
    return false;
  }
}

async function detect(imagePath) {
  const ok = await load();
  if (!ok) return { available: false, labels: [], error: loadError };
  try {
const dets = await yolo.detect(model, imagePath, 0.4);
    return {
      available: true,
      labels: dets.map(d => ({ label: d.class, confidence: Number(d.score.toFixed(3)), box: d.box || null })),
      model: 'yolov8n'
    };
  } catch (e) {
    return { available: false, labels: [], error: `Detection failed: ${e.message}` };
  }
}

module.exports = { detect, load, status: () => ({ ready: !!rt, error: loadError }) };