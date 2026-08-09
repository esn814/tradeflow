FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY server/package*.json ./
RUN npm install
COPY server/ .
EXPOSE 10000
CMD ["node", "index.js"]
