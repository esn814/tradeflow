# --- Build stage ---
FROM node:18-alpine AS builder
WORKDIR /app

# Copy server package files
COPY server/package.json server/package-lock.json ./

# Install all deps (including devDependencies for esbuild)
RUN npm ci

# Install esbuild
RUN npm install --save-dev esbuild

# Copy the entire server source
COPY server/ ./

# Bundle ESM → CJS
RUN node -e "
const esbuild = require('esbuild');
esbuild.buildSync({
  entryPoints: ['index.js'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/server.cjs',
  external: [
    'express', 'cors', 'helmet', 'cookie-parser', 'pino-http',
    'express-rate-limit', '@sentry/node', 'better-sqlite3',
    'ethers', 'jsonwebtoken', 'pino', 'pino-pretty', 'siwe', 'web-push'
  ],
  sourcemap: true,
  minify: false,
});
"

# --- Runtime stage ---
FROM node:18-alpine
WORKDIR /app

# Copy production package files
COPY server/package.json server/package-lock.json ./

# Install production deps only
RUN npm ci --omit=dev && npm cache clean --force

# Copy the bundled output + migrations + db folder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/db ./db

# Create data dir for SQLite
RUN mkdir -p /app/data

# Expose port (Render sets PORT env var)
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:10000/api/health || exit 1

# Start the bundled server
CMD ["node", "dist/server.cjs"]
