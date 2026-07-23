/**
 * Input validation middleware for TradeFlow API
 * Sanitizes and validates request bodies to prevent injection and bad data.
 */

/** Strip HTML tags from strings */
function sanitizeString(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/<[^>]*>/g, '').trim().slice(0, 10000);
}

/** Recursively sanitize all string values in an object */
function sanitizeBody(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      clean[key] = sanitizeString(val);
    } else if (typeof val === 'object' && val !== null) {
      clean[key] = sanitizeBody(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Sanitize middleware — strips HTML tags from all string fields in req.body.
 */
export function sanitize(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeBody(req.body);
  }
  next();
}

/**
 * Require specific fields in the request body.
 * Returns 400 if any listed field is missing/empty.
 */
export function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => {
      const val = req.body?.[f];
      return val === undefined || val === null || val === '';
    });
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }
    next();
  };
}

/**
 * Validate that a field is a non-negative finite number (if present).
 */
export function validateNumber(field) {
  return (req, res, next) => {
    const val = req.body?.[field];
    if (val !== undefined && val !== null && (typeof val !== 'number' || val < 0 || !isFinite(val))) {
      return res.status(400).json({ error: `${field} must be a non-negative finite number` });
    }
    next();
  };
}

/**
 * Validate that a field matches one of the allowed values (if present).
 */
export function validateEnum(field, allowed) {
  return (req, res, next) => {
    const val = req.body?.[field];
    if (val !== undefined && val !== null && !allowed.includes(val)) {
      return res.status(400).json({ error: `${field} must be one of: ${allowed.join(', ')}` });
    }
    next();
  };
}
