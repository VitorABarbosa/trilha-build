// Quebra upstream/apps/web/app/locales/en/translation.json em work/i18n/en/NNN.json
// (<=120 strings cada, objeto plano chave->texto). Pedaços já traduzidos em
// work/i18n/pt/NNN.json são mantidos; o script só avisa quais faltam.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { flatten, chunk } from "./util.mjs";

const SRC = "upstream/apps/web/app/locales/en/translation.json";
const OUT = "work/i18n/en";
const SIZE = 120;

const flat = flatten(JSON.parse(readFileSync(SRC, "utf8")));
const parts = chunk([...flat.entries()], SIZE);
if (existsSync(OUT)) for (const f of readdirSync(OUT)) rmSync(`${OUT}/${f}`);
mkdirSync(OUT, { recursive: true });
mkdirSync("work/i18n/pt", { recursive: true });
parts.forEach((p, i) => {
  const name = String(i + 1).padStart(3, "0");
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(Object.fromEntries(p), null, 2) + "\n");
});
const missing = parts
  .map((_, i) => String(i + 1).padStart(3, "0"))
  .filter((n) => !existsSync(`work/i18n/pt/${n}.json`));
console.log(
  `${flat.size} strings em ${parts.length} pedaços; faltam traduzir: ${missing.length ? missing.join(" ") : "nenhum"}`,
);
