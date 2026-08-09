// server/logger.js — Structured logging with pino
// Replaces console.log/console.error with JSON-structured, leveled output

import pino from 'pino';
import config from './config.js';

const pinoConfig = {
  level: config.LOG_LEVEL,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
};

// Pretty-print only in development (pino-pretty can fail in some environments)
if (config.NODE_ENV !== 'production') {
  try {
    pinoConfig.transport = { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } };
  } catch {
    // pino-pretty not available, use JSON output
  }
}

export const logger = pino(pinoConfig);
export default logger;
