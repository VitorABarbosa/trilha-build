import { test } from "node:test";
import assert from "node:assert/strict";
import { flatten, unflatten, placeholders, chunk } from "./util.mjs";

test("flatten/unflatten são inversos e preservam ordem", () => {
  const src = { a: { b: "x", c: { d: "y" } }, e: "z" };
  const flat = flatten(src);
  assert.deepEqual([...flat.keys()], ["a.b", "a.c.d", "e"]);
  assert.deepEqual(unflatten(flat), src);
});

test("placeholders extrai {{x}}, <tag> e $t()", () => {
  assert.deepEqual(placeholders("Olá {{name}}, <b>veja</b> $t(common.ok)"), [
    "{{name}}",
    "<b>",
    "</b>",
    "$t(common.ok)",
  ]);
  assert.deepEqual(placeholders("sem nada"), []);
});

test("chunk divide em blocos do tamanho pedido", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
