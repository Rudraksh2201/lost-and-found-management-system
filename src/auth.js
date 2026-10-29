const crypto = require('crypto');
const config = require('./config');

const sessions = new Map();
const loginAttempts = new Map();
const TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const MAX_LOGIN_TRACKED_IPS = 10000;

function loginRateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let attempt = loginAttempts.get(ip);

  if (!attempt || now - attempt.startedAt >= LOGIN_WINDOW_MS) {
    attempt = { startedAt: now, count: 0, blockedUntil: 0 };
    loginAttempts.set(ip, attempt);
  }

  if (attempt.blockedUntil > now) {
    res.set('Retry-After', String(Math.ceil((attempt.blockedUntil - now) / 1000)));
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }

  req.recordLoginResult = success => {
    if (success) {
      loginAttempts.delete(ip);
      return;
    }

    attempt.count++;
    if (attempt.count >= LOGIN_MAX_ATTEMPTS) attempt.blockedUntil = Date.now() + LOGIN_WINDOW_MS;

    if (loginAttempts.size > MAX_LOGIN_TRACKED_IPS) {
      for (const [key, entry] of loginAttempts) {
        if (Date.now() - entry.startedAt >= LOGIN_WINDOW_MS) {
          loginAttempts.delete(key);
        }
        if (loginAttempts.size <= MAX_LOGIN_TRACKED_IPS) break;
      }
    }
  };

  next();
}

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
  const now = Date.now();
  for (const [sessionToken, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(sessionToken);
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: now + TTL_MS });
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

module.exports = { login, verify, logout, requireAdmin, adminConfigured, loginRateLimit };