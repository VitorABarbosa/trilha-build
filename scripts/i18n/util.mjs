export function flatten(obj, prefix = "", out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

export function unflatten(map) {
  const out = {};
  for (const [key, v] of map) {
    const parts = key.split(".");
    let cur = out;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] ??= {};
      cur = cur[parts[i]];
    }
    cur[parts.at(-1)] = v;
  }
  return out;
}

const PH = /\{\{[^}]+\}\}|<\/?[a-zA-Z][^>]*>|\$t\([^)]*\)/g;

export function placeholders(str) {
  return typeof str === "string" ? (str.match(PH) ?? []) : [];
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
