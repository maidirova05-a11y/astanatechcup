#!/usr/bin/env bash
# Проверка Docker-версии: собрать, поднять и убедиться, что сайт и база
# работают. Запускается в CI (.github/workflows/docker.yml), можно и руками
# на сервере после восстановления.
#
#   docker/smoke.sh          собрать, поднять, проверить
#   docker/smoke.sh check    только проверить уже запущенное
set -euo pipefail
cd "$(dirname "$0")/.."

BASE=http://127.0.0.1:${APP_PORT:-3102}
SITE=${SITE_URL:-https://astanatechcup.kz}
CI_MARK="# создан docker/smoke.sh — тестовые секреты"
FAIL=0

if [ "${1:-}" != check ]; then
  if [ ! -f docker.env ]; then
    # Тестовые секреты — только для проверки, не для боевого запуска.
    {
      echo "$CI_MARK"
      grep -vE '^(ENCRYPTION_KEY|CSRF_SECRET)=' docker.env.example
      node scripts/keygen.mjs | grep -E '^(ENCRYPTION_KEY|CSRF_SECRET)='
    } > docker.env
  fi
  docker compose up -d --build
fi

for _ in $(seq 1 90); do
  curl -sf -o /dev/null "$BASE/robots.txt" && break
  sleep 2
done

ok() { echo "  ✓ $*"; }
bad() { echo "  ✗ $*"; FAIL=1; }
expect() { # expect <код> <путь> [curl-аргументы…]
  local want=$1 path=$2; shift 2
  local got; got=$(curl -s -o /dev/null -w '%{http_code}' "$@" "$BASE$path")
  [ "$got" = "$want" ] && ok "$path → $got" || bad "$path → $got (ожидалось $want)"
}
db() { docker compose exec -T db psql -U app -d app -XAtqc "$1"; }

echo "astanatechcup: $BASE"
[ "$(docker compose ps -a migrate --format '{{.ExitCode}}')" = 0 ] && ok "миграции применены" || bad "миграции не прошли"
for p in /ru /kk /en /ru/categories /ru/results /ru/privacy /robots.txt /sitemap.xml; do expect 200 "$p"; done
grep -q "<link rel=\"canonical\" href=\"$SITE/ru\"" <<<"$(curl -s "$BASE/ru")" && ok "canonical = $SITE/ru" || bad "canonical не $SITE/ru"
grep -q "<loc>$SITE/ru</loc>" <<<"$(curl -s "$BASE/sitemap.xml")" && ok "sitemap на $SITE" || bad "sitemap не на $SITE"
[ "$(curl -s -o /dev/null -w '%{content_type}' "$BASE/ru/opengraph-image")" = image/png ] && ok "картинка для соцсетей" || bad "opengraph-image не PNG"

# CSP-отчёт проходит через лимитер, который пишет в rate_limit_hits — так
# проверяем и подключение к базе по TLS, и таблицу из миграции 0005.
BEFORE=$(db 'select count(*) from rate_limit_hits')
expect 204 /api/csp-report -X POST -H 'Content-Type: application/csp-report' \
  -H "X-Real-IP: 198.51.100.$((RANDOM % 250))" \
  --data "{\"csp-report\":{\"document-uri\":\"$SITE/ru\",\"violated-directive\":\"img-src\"}}"
AFTER=$(db 'select count(*) from rate_limit_hits')
[ "$AFTER" -gt "$BEFORE" ] && ok "запись в базу ($BEFORE → $AFTER)" || bad "в rate_limit_hits ничего не записалось"
[ "$(db 'select count(*) from drizzle.__drizzle_migrations')" -ge 6 ] && ok "журнал миграций на месте" || bad "журнал миграций пуст"

if [ "$FAIL" -ne 0 ]; then
  docker compose ps -a
  docker compose logs --tail 80
  exit 1
fi
echo "astanatechcup: всё работает"
