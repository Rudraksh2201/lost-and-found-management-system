require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./src/config');
const store = require('./src/db/store');
const auth = require('./src/auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(express.static(path.resolve(__dirname, 'public')));
app.use('/uploads', express.static(config.uploadDir));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/items', require('./src/routes/items'));
app.use('/api/matches', require('./src/routes/matches'));
app.use('/api/claims', require('./src/routes/claims'));

app.get('/api/stats', auth.requireAdmin, async (req, res, next) => {
  try {
    res.json(await store.stats());
  } catch (e) { next(e); }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: config.mongoUri ? 'mongo' : 'json', uptime: process.uptime() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  res.status(status).json({ error: err.message || 'Server error' });
});

store.init()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Lost & Found API running at http://localhost:${config.port}`);
      console.log(`DB mode: ${config.mongoUri ? 'MongoDB' : 'JSON file store'}`);
    });
  })
  .catch(e => {
    console.error('Failed to initialize store:', e.message);
    process.exit(1);
  });