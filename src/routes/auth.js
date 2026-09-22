const express = require('express');
const auth = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const username = String(req.body.username || '');
  const password = String(req.body.password || '');
  const result = auth.login(username, password);
  if (!result.ok) return res.status(401).json({ error: result.error });
  res.json({ token: result.token });
});

router.post('/logout', auth.requireAdmin, (req, res) => {
  auth.logout(req.adminToken);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!auth.verify(token)) return res.status(401).json({ authed: false });
  res.json({ authed: true });
});

module.exports = router;