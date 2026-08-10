# --- Build stage ---
FROM node:18-alpine AS builder
WORKDIR /app

# Copy the entire server directory
COPY server/ ./

# Install all deps (including devDependencies for esbuild)
RUN npm ci

# Bundle ESM → CJS using esbuild (already a devDependency)
RUN npx esbuild index.js --bundle --platform=node --target=node18 --format=cjs --outfile=dist/server.cjs --external:express --external:cors --external:helmet --external:cookie-parser --external:pino-http --external:express-rate-limit --external:@sentry/node --external:better-sqlite3 --external:ethers --external:jsonwebtoken --external:pino --external:pino-pretty --external:siwe --external:web-push --sourcemap

# --- Runtime stage ---
FROM node:18-alpine
WORKDIR /app

# Copy package files for production install
COPY server/package.json server/package-lock.json ./

# Install production deps only
RUN npm ci --omit=dev && npm cache clean --force

# Copy the bundled output + migrations
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

# Create data dir for SQLite
RUN mkdir -p /app/data

# Expose port (Render sets PORT env var)
EXPOSE 10000

# Start the bundled server
CMD ["node", "dist/server.cjs"]
