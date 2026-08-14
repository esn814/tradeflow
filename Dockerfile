FROM node:20-alpine AS builder

WORKDIR /app

# Disable production mode so devDependencies install
ENV NODE_ENV=development

# Copy package files first
COPY package*.json ./
COPY server/package*.json ./server/

# Install ALL dependencies (including devDependencies for vite + esbuild)
RUN npm install
RUN cd server && npm install

# Copy source code
COPY . .

# Build frontend with Vite
RUN npm run build

# Build backend with esbuild (ESM→CJS bundling)
RUN cd server && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install production dependencies only
RUN npm install --omit=dev
RUN cd server && npm install --omit=dev

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy built backend
COPY --from=builder /app/server/dist ./server/dist

# Copy source code (for any runtime needs)
COPY --from=builder /app/server ./server

# Set working directory to server
WORKDIR /app/server

# Start backend with bundled CJS file
CMD ["node", "dist/server.cjs"]
