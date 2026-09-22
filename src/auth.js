const crypto = require('crypto');
const config = require('./config');

const sessions = new Map();
const TTL_MS = 12 * 60 * 60 * 1000;

function adminConfigured() {
  return !!(config.adminUsername && config.adminPassword);
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function login(username, password) {
  if (!adminConfigured()) {
    return { ok: false, error: 'Admin credentials are not configured on the server (check .env).' };
  }
  if (!safeEqual(username, config.adminUsername) || !safeEqual(password, config.adminPassword)) {
    return { ok: false, error: 'Invalid username or password' };
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + TTL_MS });
  return { ok: true, token };
}

function verify(token) {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function logout(token) {
  if (token) sessions.delete(token);
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verify(token)) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  req.adminToken = token;
  next();
}

module.exports = { login, verify, logout, requireAdmin, adminConfigured };