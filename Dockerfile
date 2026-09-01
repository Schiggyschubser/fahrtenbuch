ARG NODE_VERSION=24-bookworm-slim

FROM node:${NODE_VERSION} AS dependencies

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION} AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_PATH=/tmp/fahrtenbuch-build/fahrtenbuch.db \
    BACKUP_DIR=/tmp/fahrtenbuch-build/backups

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:${NODE_VERSION} AS runner

ARG VERSION=dev
ARG REVISION=unknown
ARG IMAGE_TITLE="Fahrtenbuch Custom"
ARG SOURCE_URL="https://github.com/CelduinX/fahrtenbuch"

LABEL org.opencontainers.image.title="${IMAGE_TITLE}" \
      org.opencontainers.image.description="Private Fahrtenverwaltung für den eigenen Docker-Server" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    TZ=Europe/Berlin \
    DATABASE_PATH=/app/data/fahrtenbuch.db \
    BACKUP_DIR=/app/data/backups

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/lib/db/migrations ./lib/db/migrations
COPY --from=builder --chown=node:node /app/scripts/disable-two-factor.mjs ./scripts/disable-two-factor.mjs
COPY --from=builder --chown=node:node /app/scripts/reset-admin.mjs ./scripts/reset-admin.mjs
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --chown=root:root docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod 755 /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/data/backups \
  && chown -R node:node /app/data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
