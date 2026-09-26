# AstanaTechCup в контейнере — запасной вариант на случай, если Vercel или
# Neon недоступны. Как запускать и восстанавливать данные — BACKUP.md.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Этот же этап запускает миграции (сервис migrate в compose.yaml): в нём есть
# drizzle-kit и папка drizzle/.
FROM deps AS build
COPY . .
# robots.txt и sitemap.xml собираются заранее — адрес сайта нужен уже здесь,
# иначе в них окажется localhost. Публичные ключи тоже вшиваются при сборке.
ARG SITE_URL=https://astanatechcup.kz
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
ARG NEXT_PUBLIC_ANALYTICS_DOMAIN=""
ARG NEXT_PUBLIC_ANALYTICS_SRC=""
ENV APP_URL=$SITE_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_ANALYTICS_DOMAIN=$NEXT_PUBLIC_ANALYTICS_DOMAIN \
    NEXT_PUBLIC_ANALYTICS_SRC=$NEXT_PUBLIC_ANALYTICS_SRC \
    NEXT_OUTPUT=standalone
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]
