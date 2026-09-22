#!/usr/bin/env bash
# Aplica o overlay pt-BR numa árvore do Mentingo. Uso: scripts/apply-overlay.sh <dir-upstream>
# Falha alto se o upstream mudou de forma que o overlay não encaixa.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?informe o diretório do upstream}"

cd "$DIR"
for p in "$ROOT"/patches/*.patch; do
  git apply --check "$p"
  git apply "$p"
  echo "patch aplicado: $(basename "$p")"
done

cp -r "$ROOT"/overlay/. .
test -f apps/web/app/locales/pt/translation.json
test -f apps/web/app/assets/svgs/flags/pt-flag.svg

# Cliente gerado: inserir "pt" na união de idiomas.
UNION='"en" | "pl" | "de" | "lt" | "cs" | "es" | "fr"'
N=$(grep -c "$UNION" apps/web/app/api/generated-api.ts || true)
[ "$N" -gt 0 ] || { echo "união de idiomas não encontrada em generated-api.ts"; exit 1; }
sed -i "s/$UNION/$UNION | \"pt\"/g" apps/web/app/api/generated-api.ts
echo "generated-api.ts: $N uniões atualizadas"

# Schema swagger: inserir "pt" em cada enum de idioma (anyOf de const ou array de strings).
node - <<'EOF'
const fs = require("fs");
const f = "apps/api/src/swagger/api-schema.json";
const s = JSON.parse(fs.readFileSync(f, "utf8"));
const LANGS = ["en", "pl", "de", "lt", "cs", "es", "fr"];
let n = 0;
const walk = (o) => {
  if (Array.isArray(o)) {
    const consts = o.map((x) => x && typeof x === "object" && x.const);
    if (o.length === 7 && LANGS.every((l) => consts.includes(l))) {
      o.push({ const: "pt", type: "string" });
      n++;
    } else if (o.length === 7 && LANGS.every((l) => o.includes(l))) {
      o.push("pt");
      n++;
    }
    o.forEach(walk);
  } else if (o && typeof o === "object") Object.values(o).forEach(walk);
};
walk(s);
if (n === 0) {
  console.error("nenhuma enum de idioma em api-schema.json");
  process.exit(1);
}
fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n");
console.log(`api-schema.json: ${n} enums atualizadas`);
EOF

grep -q 'PT: "pt"' packages/shared/src/constants/languages.ts
echo "overlay ok"
