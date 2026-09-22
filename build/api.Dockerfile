# syntax=docker/dockerfile:1.7
# trilha-api: Mentingo (tag fixa) + overlay pt-BR. Espelha api.Dockerfile do upstream.
FROM node:20.15.0-alpine AS source
ARG MENTINGO_VERSION
RUN apk add --no-cache git bash
WORKDIR /src
RUN git clone --depth 1 --branch "${MENTINGO_VERSION}" https://github.com/Selleo/mentingo.git .
COPY patches/ /overlay-src/patches/
COPY overlay/ /overlay-src/overlay/
COPY scripts/apply-overlay.sh /overlay-src/scripts/apply-overlay.sh
RUN bash /overlay-src/scripts/apply-overlay.sh /src && rm -rf .git

FROM node:20.15.0-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9.15.2
WORKDIR /app
COPY --from=source /src .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install
RUN pnpm -w packages:build
RUN pnpm build --filter=api
RUN pnpm deploy --filter=api pnpm-deploy-output --prod

FROM node:20.15.0-alpine
WORKDIR /app
COPY --from=base /app/pnpm-deploy-output /app
RUN apk add --no-cache \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto \
    xvfb libc6-compat ffmpeg libreoffice curl \
    && rm -rf /var/cache/apk/*
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# db:seed-prod roda "tsx ./src/seed/seed-prod.ts"; tsx é devDependency no upstream.
RUN npm install -g tsx@4.20.6
RUN chmod +x /app/entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
