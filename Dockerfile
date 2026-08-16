# ==============================================================================
# Stage 1: Build & Prune (Alpine Linux)
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install openssl for Prisma engine binaries on Alpine
RUN apk add --no-cache openssl

# Install dependencies
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build TypeScript to dist/
COPY src ./src
RUN npm run build

# Remove devDependencies for minimal image footprint
RUN npm prune --production

# ==============================================================================
# Stage 2: Production Minimal Alpine Runner
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Install openssl for Prisma runtime and dumb-init for proper PID 1 signal forwarding
RUN apk add --no-cache openssl dumb-init

ENV NODE_ENV=production
ENV PORT=8000

# Copy runtime assets and artifacts from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

# Create database and app data directory with correct ownership for node user
RUN mkdir -p /app/data /app/prisma && chown -R node:node /app

USER node

EXPOSE 8000

# Docker Healthcheck targeting the deep health probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8000/api/health | grep -q '"status":"ok"' || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
