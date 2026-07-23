import { Router } from 'express';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { getDb, upsertUser } from './db.js';

// ── FIX #4: Require JWT_SECRET — no file-based fallback ──
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required. Exiting.');
  process.exit(1);
}
export const JWT_SECRET = process.env.JWT_SECRET;

// ── FIX #7: Explicit algorithm ──
const JWT_ALGORITHM = 'HS256';

// ── FIX #5: Short-lived JWT + refresh token (7d) ──
const JWT_EXPIRY = '5m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── FIX #6: SIWE domain binding ──
const SIWE_DOMAIN = process.env.SIWE_DOMAIN || 'tradeflow.cloud.hyperpaxeer.com';

// ── In-memory nonce store (short-lived, no persistence needed) ──
const nonces = new Map();
const MAX_NONCES = 10_000;

// Clean up old nonces every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [k, v] of nonces) {
    if (v.ts < cutoff) nonces.delete(k);
  }
}, 5 * 60 * 1000);

// ── Refresh token persistence in SQLite (survives restarts) ──
function storeRefreshToken(token, userId, address) {
  const db = getDb();
  db.prepare(
    'INSERT INTO refresh_tokens (token, user_id, address, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, address, Date.now() + REFRESH_TTL_MS);
}

function getRefreshToken(token) {
  const db = getDb();
  return db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(token);
}

function deleteRefreshToken(token) {
  const db = getDb();
  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);
}

// Clean up expired refresh tokens every 5 minutes
setInterval(() => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(Date.now());
  } catch {}
}, 5 * 60 * 1000);

const router = Router();

// ─── POST /api/auth/nonce — generate a SIWE nonce ─────────────
router.post('/nonce', (req, res) => {
  if (nonces.size >= MAX_NONCES) {
    return res.status(429).json({ error: 'Too many pending requests. Try again shortly.' });
  }
  const nonce = randomBytes(16).toString('hex');
  nonces.set(nonce, { ts: Date.now() });
  res.json({ nonce });
});

// ─── POST /api/auth/verify — verify SIWE signature, issue JWT ─
router.post('/verify', async (req, res) => {
  try {
    const { message, signature } = req.body;
    if (!message || !signature) {
      return res.status(400).json({ error: 'Authentication failed' });
    }

    const { SiweMessage } = await import('siwe');
    const siwe = new SiweMessage(message);

    // FIX #8: Atomic check-and-delete BEFORE verification (prevents TOCTOU race)
    const nonceRecord = nonces.get(siwe.nonce);
    if (!nonceRecord) {
      return res.status(400).json({ error: 'Authentication failed' });
    }
    nonces.delete(siwe.nonce);

    // FIX #6: Verify with domain binding
    let result;
    try {
      result = await siwe.verify({ signature, domain: SIWE_DOMAIN });
    } catch {
      return res.status(401).json({ error: 'Authentication failed' });
    }
    if (!result.success) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Upsert user in DB
    const user = upsertUser(siwe.address);

    // FIX #5 + #7: Short-lived JWT with explicit algorithm
    const token = jwt.sign(
      { userId: user.id, address: user.address },
      JWT_SECRET,
      { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRY }
    );

    // Issue refresh token — persisted in SQLite (survives restarts)
    const refreshToken = randomBytes(32).toString('hex');
    storeRefreshToken(refreshToken, user.id, user.address);

    res.cookie('tf_rt', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: REFRESH_TTL_MS,
      path: '/api/auth',
    });

    res.json({
      token,
      user: { id: user.id, address: user.address },
      address: user.address,
    });
  } catch (err) {
    console.error('Auth verify error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ─── POST /api/auth/refresh — exchange refresh token for new JWT ─
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies?.tf_rt;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const data = getRefreshToken(refreshToken);
  if (!data || data.expires_at < Date.now()) {
    if (data) deleteRefreshToken(refreshToken);
    res.clearCookie('tf_rt', { path: '/api/auth' });
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Issue new short-lived JWT
  const token = jwt.sign(
    { userId: data.user_id, address: data.address },
    JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRY }
  );

  res.json({ token, address: data.address });
});

// ─── POST /api/auth/logout — revoke refresh token ─────────────
router.post('/logout', (req, res) => {
  const refreshToken = req.cookies?.tf_rt;
  if (refreshToken) {
    deleteRefreshToken(refreshToken);
  }
  res.clearCookie('tf_rt', { path: '/api/auth' });
  res.json({ ok: true });
});

// ─── Auth middleware: verify JWT, attach user to request ───────
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  try {
    // FIX #7: Explicit algorithm in verify
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
    req.userId = payload.userId;
    req.address = payload.address;
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

export default router;
