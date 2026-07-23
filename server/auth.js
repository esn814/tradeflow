import { Router } from 'express';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { upsertUser } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SECRET_PATH = join(__dirname, '.jwt-secret');

function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (existsSync(SECRET_PATH)) return readFileSync(SECRET_PATH, 'utf8').trim();
  const secret = randomBytes(32).toString('hex');
  writeFileSync(SECRET_PATH, secret);
  return secret;
}

export const JWT_SECRET = getSecret();
const JWT_EXPIRY = '7d';

// In-memory nonce store (short-lived, no persistence needed)
const nonces = new Map();

// Clean up old nonces every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [k, v] of nonces) {
    if (v.ts < cutoff) nonces.delete(k);
  }
}, 5 * 60 * 1000);

const router = Router();

// POST /api/auth/nonce — generate a SIWE nonce
router.post('/nonce', (req, res) => {
  const nonce = randomBytes(16).toString('hex');
  nonces.set(nonce, { ts: Date.now() });
  res.json({ nonce });
});

// POST /api/auth/verify — verify SIWE signature, return JWT
router.post('/verify', async (req, res) => {
  try {
    const { message, signature } = req.body;
    if (!message || !signature) {
      return res.status(400).json({ error: 'Missing message or signature' });
    }

    // Parse and verify the SIWE message
    const { SiweMessage } = await import('siwe');
    const siwe = new SiweMessage(message);

    // Extract nonce from the message and verify it was issued by us
    const nonceRecord = nonces.get(siwe.nonce);
    if (!nonceRecord) {
      return res.status(400).json({ error: 'Invalid or expired nonce' });
    }

    // Verify the signature
    const result = await siwe.verify({ signature });
    if (!result.success) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Consume the nonce
    nonces.delete(siwe.nonce);

    // Upsert user in DB
    const user = upsertUser(siwe.address);

    // Issue JWT
    const token = jwt.sign(
      { userId: user.id, address: user.address },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

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

// Middleware: verify JWT and attach user info to request
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    req.address = payload.address;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export default router;
