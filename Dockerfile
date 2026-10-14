# syntax=docker/dockerfile:1
# OpenCSR production image (multi-stage, runs as a non-root user).

FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholders only; real values are provided at runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" AUTH_SECRET="build-time-placeholder-value-not-used-at-runtime-000"
RUN npx prisma generate && npx next build && node scripts/build-scripts.mjs

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 STORAGE_LOCAL_DIR=/app/storage
# Prisma CLI for `migrate deploy` at start-up (same version as the app).
RUN npm install -g prisma@6.19.3 && npm cache clean --force
RUN groupadd --system --gid 1001 opencsr && useradd --system --uid 1001 --gid opencsr opencsr
COPY --from=builder /app/public ./public
COPY --from=builder --chown=opencsr:opencsr /app/.next/standalone ./
COPY --from=builder --chown=opencsr:opencsr /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist-scripts ./dist-scripts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/storage && chown opencsr:opencsr /app/storage
USER opencsr
EXPOSE 3000
VOLUME ["/app/storage"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
