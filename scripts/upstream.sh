#!/usr/bin/env bash
# Clona o Mentingo na tag fixada em MENTINGO_VERSION para ./upstream (ignorado no git).
# Uso: scripts/upstream.sh [--force]
set -euo pipefail
cd "$(dirname "$0")/.."

TAG="$(tr -d '[:space:]' < MENTINGO_VERSION)"
REPO="https://github.com/Selleo/mentingo.git"

if [ -d upstream ] && [ "${1:-}" != "--force" ]; then
  CUR="$(git -C upstream describe --tags --exact-match 2>/dev/null || echo none)"
  if [ "$CUR" = "$TAG" ]; then
    echo "upstream já em $TAG"; exit 0
  fi
  echo "upstream em $CUR, esperado $TAG; use --force para reclonar"; exit 1
fi

rm -rf upstream
git -c core.longpaths=true clone --depth 1 --branch "$TAG" "$REPO" upstream
git -C upstream config core.longpaths true
# Windows: o checkout inicial pode falhar em caminhos longos; garantir árvore completa.
git -C upstream restore --source=HEAD :/ 2>/dev/null || true
test -f upstream/package.json
test -f upstream/api.Dockerfile
test -f upstream/web.Dockerfile
echo "upstream pronto em $TAG ($(git -C upstream rev-parse --short HEAD))"
