# Stage 1: Build native modules
FROM node:22-slim AS builder

WORKDIR /app

# Install build deps for better-sqlite3 (native module)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files and install ALL deps (including dev for native rebuild)
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Production image
FROM node:22-slim

WORKDIR /app

# Copy built node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy source
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Render sets PORT automatically
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:3001/api/health || exit 1

RUN addgroup --system app && adduser --system --ingroup app app
RUN chown -R app:app /app
USER app

CMD ["node", "index.js"]
