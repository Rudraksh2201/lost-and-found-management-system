const mongoose = require('mongoose');
const config = require('../config');
const Item = require('../models/Item');
const Claim = require('../models/Claim');
const { sampleItems } = require('./sampleData');

async function init() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  if ((await Item.countDocuments()) === 0) {
    await Item.insertMany(sampleItems());
  }
}

function objId(v) {
  return mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(v) : null;
}

async function allItems() { return Item.find().lean(); }

async function listItems(f) {
  const q = {};
  if (f.search) q.$or = [
    { title: { $regex: f.search, $options: 'i' } },
    { desc: { $regex: f.search, $options: 'i' } }
  ];
  if (f.category && f.category !== 'All') q.category = f.category;
  if (f.location && f.location !== 'All') q.location = f.location;
  if (f.status && f.status !== 'All') q.status = f.status;
  if (f.type && f.type !== 'All') q.type = f.type;
  return Item.find(q).sort({ createdAt: -1 }).limit(200).lean();
}

async function getItem(id) {
  const _id = objId(id);
  if (!_id) return null;
  return Item.findById(_id).lean();
}

async function createItem(data) {
  return (await Item.create(data)).toObject();
}

async function updateItem(id, patch) {
  const _id = objId(id);
  if (!_id) return null;
  return Item.findByIdAndUpdate(_id, { $set: patch }, { new: true }).lean();
}

async function deleteItem(id) {
  const _id = objId(id);
  if (!_id) return false;
  await Claim.deleteMany({ itemId: _id });
  return !!(await Item.findByIdAndDelete(_id));
}

async function listClaims() { return Claim.find().sort({ createdAt: -1 }).lean(); }

async function createClaim(data) {
  return (await Claim.create(data)).toObject();
}

async function updateClaim(id, patch) {
  const _id = objId(id);
  if (!_id) return null;
  return Claim.findByIdAndUpdate(_id, { $set: patch }, { new: true }).lean();
}

async function stats() {
  const [lost, found, recovered] = await Promise.all([
    Item.countDocuments({ status: 'Lost' }),
    Item.countDocuments({ status: 'Found' }),
    Item.countDocuments({ status: 'Recovered' })
  ]);
  const pendingClaims = await Claim.countDocuments({ status: 'pending' });
  return { lost, found, recovered, total: lost + found + recovered, pendingClaims };
}

module.exports = { init, allItems, listItems, getItem, createItem, updateItem, deleteItem, listClaims, createClaim, updateClaim, stats, model: Item };