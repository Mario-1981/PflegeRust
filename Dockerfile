# syntax=docker/dockerfile:1.7

# Stage 1: Build Vite + React + PWA production bundle
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# Stage 2: Minimal Nginx production runtime
FROM nginx:1.27-alpine AS runtime

ARG APP_VERSION=1.5.0
LABEL org.opencontainers.image.title="PflegeRust" \
      org.opencontainers.image.description="Mobiles Pflegemanagement (PWA) für ambulante und stationäre Dienste" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.licenses="Apache-2.0"

RUN rm -rf /usr/share/nginx/html/*
COPY packaging/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
