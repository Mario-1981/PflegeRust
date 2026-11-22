# syntax=docker/dockerfile:1.7

# Stage 1: Frontend (Vite + PWA) & Backend (Express + MariaDB) bauen
FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY . .
RUN npm run build

# Minimale produktive Runtime-Abhängigkeiten (nur express + mysql2) vorbereiten
RUN mkdir -p /runtime-deps && \
    printf '{"name":"pflegerust-server","private":true,"type":"module","dependencies":{"express":"^4.21.2","mysql2":"^3.11.0"}}\n' > /runtime-deps/package.json && \
    cd /runtime-deps && npm install --omit=dev --no-audit --no-fund --no-package-lock

# Stage 2: All-in-One Produktions-Container (Node.js 24 + MariaDB 10.11 + PflegeRust)
FROM node:24-bookworm-slim AS runtime

ARG APP_VERSION=1.5.0
LABEL org.opencontainers.image.title="PflegeRust" \
      org.opencontainers.image.description="All-in-One Pflegemanagement (PWA) mit integrierter MariaDB-Datenbank" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.licenses="Apache-2.0"

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      mariadb-server \
      mariadb-client \
      openssl \
      curl \
      ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/share/pflegerust

COPY --from=builder /app/dist /usr/share/pflegerust/dist
COPY --from=builder /app/dist-server/server.mjs /usr/share/pflegerust/server.mjs
COPY --from=builder /runtime-deps/package.json /usr/share/pflegerust/package.json
COPY --from=builder /runtime-deps/node_modules /usr/share/pflegerust/node_modules
COPY packaging/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    mkdir -p /var/lib/pflegerust /run/mysqld && \
    chown -R mysql:mysql /run/mysqld /var/lib/mysql

ENV NODE_ENV=production \
    ALLOW_MEMORY_FALLBACK=false \
    HOST=0.0.0.0 \
    PORT=8080 \
    PFLEGERUST_WWW_DIR=/usr/share/pflegerust/dist

VOLUME ["/var/lib/mysql", "/var/lib/pflegerust"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
