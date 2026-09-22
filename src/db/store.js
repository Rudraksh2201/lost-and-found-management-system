const config = require('../config');

const store = config.mongoUri ? require('./mongoStore') : require('./jsonStore');

module.exports = store;