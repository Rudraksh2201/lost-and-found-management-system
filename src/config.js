require('dotenv').config();
const path = require('path');

function positiveNumber(value, fallback, name, integer = false) {
  if (value === undefined || value === '') return fallback;
  const parsed = integer ? Number.parseInt(value, 10) : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${name} must be a positive ${integer ? 'integer' : 'number'}`);
  }
  return parsed;
}

module.exports = {
  port: positiveNumber(process.env.PORT, 5000, 'PORT', true),
  mongoUri: (process.env.MONGO_URI || '').trim(),
  dbFile: path.resolve(process.env.DB_FILE || './data/db.json'),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  imgMaxMB: positiveNumber(process.env.IMG_MAX_MB, 5, 'IMG_MAX_MB'),
  embeddingsEnabled: process.env.EMBEDDINGS_ENABLED === 'true',
  detectionEnabled: process.env.DETECTION_ENABLED === 'true',
  detectionModel: process.env.DETECTION_MODEL || './models/yolov8n.onnx',
  adminUsername: process.env.ADMIN_USERNAME || '',
  adminPassword: process.env.ADMIN_PASSWORD || ''
};