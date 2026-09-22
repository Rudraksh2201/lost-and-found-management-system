require('dotenv').config();
const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongoUri: (process.env.MONGO_URI || '').trim(),
  dbFile: path.resolve(process.env.DB_FILE || './data/db.json'),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  imgMaxMB: parseFloat(process.env.IMG_MAX_MB || '5'),
  embeddingsEnabled: process.env.EMBEDDINGS_ENABLED === 'true',
  detectionEnabled: process.env.DETECTION_ENABLED === 'true',
  detectionModel: process.env.DETECTION_MODEL || './models/yolov8n.onnx',
  adminUsername: process.env.ADMIN_USERNAME || '',
  adminPassword: process.env.ADMIN_PASSWORD || ''
};