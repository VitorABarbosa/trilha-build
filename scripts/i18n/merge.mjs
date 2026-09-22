// Lê work/i18n/pt/NNN.json, valida contra o en e escreve o overlay.
// Sai com código 1 se faltar chave, sobrar chave ou placeholder divergir.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { flatten, unflatten, placeholders } from "./util.mjs";

const EN = "upstream/apps/web/app/locales/en/translation.json";
const OUT = "overlay/apps/web/app/locales/pt/translation.json";

const en = flatten(JSON.parse(readFileSync(EN, "utf8")));
const pt = new Map();
for (const f of readdirSync("work/i18n/pt").filter((f) => f.endsWith(".json")).sort()) {
  for (const [k, v] of Object.entries(JSON.parse(readFileSync(`work/i18n/pt/${f}`, "utf8")))) pt.set(k, v);
}

const errors = [];
for (const [k, v] of en) {
  if (!pt.has(k)) {
    errors.push(`faltando: ${k}`);
    continue;
  }
  const a = placeholders(v).sort().join("|");
  const b = placeholders(pt.get(k)).sort().join("|");
  if (a !== b) errors.push(`placeholder divergente em ${k}: en[${a}] pt[${b}]`);
  if (typeof pt.get(k) !== typeof v) errors.push(`tipo divergente em ${k}`);
}
for (const k of pt.keys()) if (!en.has(k)) errors.push(`sobrando: ${k}`);

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`${errors.length} problema(s)`);
  process.exit(1);
}

const ordered = new Map([...en.keys()].map((k) => [k, pt.get(k)]));
mkdirSync("overlay/apps/web/app/locales/pt", { recursive: true });
writeFileSync(OUT, JSON.stringify(unflatten(ordered), null, 2) + "\n");
console.log(`ok: ${ordered.size} strings em ${OUT}`);
