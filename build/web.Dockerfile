# syntax=docker/dockerfile:1.7
# trilha-web: SPA do Mentingo + overlay pt-BR, servido por nginx. Espelha web.Dockerfile do upstream.
# A URL pública entra em tempo de build. VITE_API_URL é o host SEM /api: o cliente gerado já prefixa /api.
FROM node:20.15.0-alpine AS source
ARG MENTINGO_VERSION
RUN apk add --no-cache git bash
WORKDIR /src
RUN git clone --depth 1 --branch "${MENTINGO_VERSION}" https://github.com/Selleo/mentingo.git .
COPY patches/ /overlay-src/patches/
COPY overlay/ /overlay-src/overlay/
COPY scripts/apply-overlay.sh /overlay-src/scripts/apply-overlay.sh
RUN bash /overlay-src/scripts/apply-overlay.sh /src && rm -rf .git

FROM node:20.15.0-alpine AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ARG VITE_API_URL
ARG VITE_APP_URL
ENV VITE_API_URL=$VITE_API_URL VITE_APP_URL=$VITE_APP_URL
RUN npm install -g pnpm@9.15.2
WORKDIR /app
COPY --from=source /src .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install
RUN pnpm -w packages:build
RUN pnpm --filter=web exec tsc --noEmit
RUN pnpm build --filter=web

FROM nginx:1.27.1
COPY --from=build /app/apps/web/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/apps/web/build/client /usr/share/nginx/html
EXPOSE 8080
