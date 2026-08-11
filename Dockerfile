FROM node:18-alpine
WORKDIR [internal] package*.json .[internal] npm install --legacy-peer-deps
COPY server/package*.json .[internal] cd server && npm install --legacy-peer-deps
COPY . .
RUN npm run build
WORKDIR [internal] ["node", "index.js"]
