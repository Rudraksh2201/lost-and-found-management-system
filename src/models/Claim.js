const mongoose = require('mongoose');

const ClaimSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  claimantName: { type: String, required: true, trim: true, maxlength: 120 },
  claimantEmail: { type: String, required: true, trim: true, maxlength: 120 },
  note: { type: String, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

ClaimSchema.index({ itemId: 1, status: 1 });

module.exports = mongoose.model('Claim', ClaimSchema);