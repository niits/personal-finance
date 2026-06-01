import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import path from "path";

// Guards against referencing a CSS custom property that was never defined in
// globals.css. An undefined `var(--token)` silently produces an invalid value
// — e.g. `background: var(--destructive)` rendered a transparent (invisible)
// button — with no console error, making it hard to catch by eye.

const SRC = path.resolve(__dirname, "..");
const GLOBALS = path.resolve(__dirname, "globals.css");

function definedTokens(): Set<string> {
  const css = readFileSync(GLOBALS, "utf8");
  const tokens = new Set<string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) tokens.add(m[1]);
  return tokens;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

function referencedTokens(): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  for (const file of walk(SRC)) {
    const content = readFileSync(file, "utf8");
    for (const m of content.matchAll(/var\((--[a-z0-9-]+)/g)) {
      const token = m[1];
      if (!refs.has(token)) refs.set(token, []);
      refs.get(token)!.push(path.relative(SRC, file));
    }
  }
  return refs;
}

describe("CSS custom property integrity", () => {
  it("every var(--token) referenced in source is defined in globals.css", () => {
    const defined = definedTokens();
    const undefinedRefs = [...referencedTokens().entries()]
      .filter(([token]) => !defined.has(token))
      .map(([token, files]) => `${token} — used in ${[...new Set(files)].join(", ")}`);

    expect(undefinedRefs, `Undefined CSS tokens:\n${undefinedRefs.join("\n")}`).toEqual([]);
  });
});

// Removes every balanced `@layer <names> { ... }` block, leaving only the
// unlayered (top-level) CSS. Statement-form declarations like
// `@layer theme, base, components, utilities;` end in `;` before any `{`, so
// they are intentionally left in place — they declare order, not styles.
function stripLayerBlocks(css: string): string {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const open = css.slice(i).match(/^@layer\b[^{;]*\{/);
    if (open) {
      let depth = 0;
      let j = i + open[0].length - 1; // position of the opening '{'
      for (; j < css.length; j++) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}" && --depth === 0) { j++; break; }
      }
      i = j; // skip the entire layer block
    } else {
      out += css[i++];
    }
  }
  return out;
}

describe("CSS cascade layering", () => {
  // An UNLAYERED universal reset (`* { margin:0; padding:0 }`) beats every
  // Tailwind `p-*` / `m-*` utility — utilities live in `@layer utilities`, and
  // unlayered styles win over any layer regardless of specificity. That silently
  // collapses padding/margin on every element styled via classes instead of
  // inline `style`. The reset must therefore stay inside a cascade layer
  // (`@layer base`) so utilities can override it.
  it("the universal margin/padding reset is not declared unlayered", () => {
    const unlayered = stripLayerBlocks(readFileSync(GLOBALS, "utf8"));
    const match = unlayered.match(/\*\s*\{[^}]*\b(?:padding|margin)\b[^}]*\}/);
    expect(
      match,
      `Found an unlayered universal reset that will override Tailwind p-*/m-* ` +
        `utilities:\n${match?.[0] ?? ""}\nWrap it in \`@layer base { … }\`.`,
    ).toBeNull();
  });
});
