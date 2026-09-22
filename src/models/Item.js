const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  type: { type: String, enum: ['Lost', 'Found'], required: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  desc: { type: String, required: true, trim: true, maxlength: 2000 },
  category: { type: String, trim: true },
  location: { type: String, trim: true },
  date: { type: String },
  image: { type: String, default: '' },
  contact: { type: String, trim: true },
  reporterName: { type: String, trim: true, maxlength: 120 },
  status: { type: String, enum: ['Lost', 'Found', 'Recovered'], default: 'Lost' },
  detected: {
    available: { type: Boolean, default: false },
    labels: [{ label: String, confidence: Number, box: [Number] }],
    error: String
  },
  embedding: {
    available: { type: Boolean, default: false },
    vector: { type: [Number], default: [] },
    model: String
  },
  ai: {
    processed: { type: Boolean, default: false },
    extracted: mongoose.Schema.Types.Mixed,
    processedAt: Date
  }
}, { timestamps: true });

ItemSchema.index({ type: 1, status: 1 });
ItemSchema.index({ category: 1 });

module.exports = mongoose.model('Item', ItemSchema);