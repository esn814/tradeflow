// server/logger.js — Structured logging with pino
// Replaces console.log/console.error with JSON-structured, leveled output

import pino from 'pino';
import config from './config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  // Pretty-print in development, JSON in production
  transport: config.NODE_ENV === 'production'
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
  // Redact sensitive fields
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

export default logger;
