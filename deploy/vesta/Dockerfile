# God's Eye View — self-host image for vesta.
# Single stage: install deps at image build; the client bundle is built at
# container start (entrypoint) so client-exposed keys (Cesium/Google) baked in
# via Vite `define` can be added later with just an .env edit + restart.
# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

# Skip Chromium download (puppeteer is a devDep used only by tests, not runtime).
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    npm_config_fund=false \
    npm_config_audit=false

WORKDIR /app

# Dependency layer (cached unless lockfile changes). npm ci installs devDeps
# (vite, vite-plugin-cesium, sharp) which the build needs — do NOT set
# NODE_ENV=production here or they get omitted.
COPY app/package.json app/package-lock.json ./
RUN npm ci

# App source.
COPY app/ ./

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8096
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
