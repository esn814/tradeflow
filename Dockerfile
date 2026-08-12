FROM node:18-alpine
COPY package*.json .[internal]
RUN npm install --legacy-peer-deps
COPY server/package*.json .[internal]
RUN cd server && npm install --legacy-peer-deps
COPY . .
