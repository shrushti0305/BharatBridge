# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine
WORKDIR /app

# Install build dependencies for better-sqlite3 native compilation
RUN apk add --no-co-cache python3 make g++

WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --only=production

COPY server/ ./
COPY --from=frontend-builder /app/client/dist /app/client/dist

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["node", "src/index.js"]
