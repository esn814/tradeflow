import { describe, it, expect, beforeAll } from 'vitest';

// Set env vars BEFORE importing auth modules
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-ci';

let jwt;
let JWT_SECRET;

beforeAll(async () => {
  const mod = await import('jsonwebtoken');
  jwt = mod.default || mod;
  const authMod = await import('../auth.js');
  JWT_SECRET = authMod.JWT_SECRET;
});

describe('JWT Token Lifecycle', () => {
  it('JWT_SECRET is loaded from environment', () => {
    expect(JWT_SECRET).toBe('test-secret-key-for-ci');
  });

  it('creates a valid JWT token', () => {
    const token = jwt.sign({ userId: 1, address: '0xabc' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('verifies a valid JWT token', () => {
    const token = jwt.sign({ userId: 42, address: '0xdef' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    const payload = jwt.verify(token, JWT_SECRET);
    expect(payload.userId).toBe(42);
    expect(payload.address).toBe('0xdef');
  });

  it('rejects an expired token', () => {
    const token = jwt.sign({ userId: 1 }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '0s' });
    // Small delay to ensure expiry
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  it('rejects a token signed with wrong secret', () => {
    const token = jwt.sign({ userId: 1 }, 'wrong-secret', { algorithm: 'HS256', expiresIn: '5m' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = jwt.sign({ userId: 1 }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
    const parts = token.split('.');
    // Tamper with payload
    parts[1] = Buffer.from(JSON.stringify({ userId: 999 })).toString('base64url');
    const tampered = parts.join('.');
    expect(() => jwt.verify(tampered, JWT_SECRET)).toThrow();
  });

  it('token contains expected claims', () => {
    const token = jwt.sign(
      { userId: 7, address: '0x123' },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '5m' }
    );
    const decoded = jwt.decode(token);
    expect(decoded.userId).toBe(7);
    expect(decoded.address).toBe('0x123');
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();
    // exp should be ~5min after iat
    expect(decoded.exp - decoded.iat).toBe(300);
  });
});
