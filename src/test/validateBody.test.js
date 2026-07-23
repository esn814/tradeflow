import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateBody } from '../../server/middleware/validateZod.js';

// Test the validateBody middleware directly — it's a pure function that
// takes a Zod schema and returns Express middleware.

function mockReqRes(body) {
  const req = { body };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  return { req, res, next, nextCalled: () => nextCalled };
}

describe('validateBody middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().positive(),
  });

  const middleware = validateBody(schema);

  it('calls next() for valid input', () => {
    const { req, res, next, nextCalled } = mockReqRes({ name: 'Alice', age: 30 });
    middleware(req, res, next);
    expect(nextCalled()).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('returns 400 for invalid input', () => {
    const { req, res, next, nextCalled } = mockReqRes({ name: '', age: -1 });
    middleware(req, res, next);
    expect(nextCalled()).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.details).toBeInstanceOf(Array);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('returns structured error details with path and message', () => {
    const { req, res, next } = mockReqRes({ name: 'Alice', age: -5 });
    middleware(req, res, next);
    expect(res.body.details[0]).toHaveProperty('path');
    expect(res.body.details[0]).toHaveProperty('message');
    expect(res.body.details[0].path).toBe('age');
  });

  it('strips unknown fields (strict mode passthrough)', () => {
    const { req, res, next, nextCalled } = mockReqRes({ name: 'Alice', age: 30, extra: 'field' });
    middleware(req, res, next);
    // Zod strips unknown fields by default (passthrough) — req.body should have the parsed result
    expect(nextCalled()).toBe(true);
    expect(req.body.extra).toBeUndefined();
  });

  it('rejects missing required fields', () => {
    const { req, res, next, nextCalled } = mockReqRes({ name: 'Alice' });
    middleware(req, res, next);
    expect(nextCalled()).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.body.details.some(d => d.path === 'age')).toBe(true);
  });

  it('rejects wrong types', () => {
    const { req, res, next, nextCalled } = mockReqRes({ name: 123, age: 'thirty' });
    middleware(req, res, next);
    expect(nextCalled()).toBe(false);
    expect(res.statusCode).toBe(400);
  });
});
