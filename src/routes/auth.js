const express = require('express');
const auth = require('../auth');

const router = express.Router();

router.post('/login', auth.loginRateLimit, (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const result = auth.login(username, password);
  req.recordLoginResult(result.ok);
  if (!result.ok) return res.status(401).json({ error: result.error });
  res.set('Cache-Control', 'no-store');
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
  res.set('Cache-Control', 'no-store');
  res.json({ authed: true });
});

module.exports = router;