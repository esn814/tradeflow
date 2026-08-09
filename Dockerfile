FROM node:20-alpine
RUN apk add --no-cache python3 make g++ tini
WORKDIR /app
COPY server/package*.json ./
RUN npm install --production
COPY server/ .
RUN mkdir -p /data
EXPOSE 10000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
