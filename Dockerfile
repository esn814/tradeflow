FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies (including devDependencies for esbuild)
RUN npm install
RUN cd server && npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Build backend with esbuild (ESM→CJS bundling)
RUN cd server && npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

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
