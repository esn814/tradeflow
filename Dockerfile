FROM node:18-alpine
WORKDIR [internal]
COPY package*.json .[internal]
RUN npm install --legacy-peer-deps
COPY server/package*.json .[internal]
RUN cd server && npm install --legacy-peer-deps
COPY . .
RUN npm run build
WORKDIR [internal]
CMD ["node", "index.js"]
