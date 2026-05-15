import fs from "node:fs";
import path from "node:path";

const HANDLER_PATH = path.resolve(
  __dirname,
  "../../.open-next/server-functions/default/handler.mjs"
);

/**
 * Patches handler.mjs for the Cloudflare Workers test environment.
 *
 * Two issues exist in the pre-built Next.js bundle when running under workerd:
 *
 * 1. node:inspector — imported by Next.js's console-dim.external.js.
 *    Not available in Workers runtime at all.
 *
 * 2. setImmediate assignment — Next.js's "fast setImmediate patch" does
 *    `globalThis.setImmediate = nodeTimers.setImmediate` which throws
 *    TypeError in Workers because nodejs_compat makes the property read-only.
 *
 * Both are patched here. This never modifies the production build artifact.
 */
export default function setup() {
  if (!fs.existsSync(HANDLER_PATH)) {
    console.warn("[global-setup] handler.mjs not found — run npm run build:cf first");
    return;
  }

  let content = fs.readFileSync(HANDLER_PATH, "utf-8");
  let patched = false;

  // Patch 1: node:inspector stub
  if (content.includes('require("node:inspector")')) {
    content = content.replace(
      /_interop_require_wildcard\(require\("node:inspector"\)\)/g,
      "({default:{}})"
    );
    patched = true;
  }

  // Patch 2: wrap the fast-setImmediate install() body in a try-catch.
  // Workers' nodejs_compat makes module properties on node:timers and
  // node:timers/promises read-only, so direct assignments throw TypeError.
  const setImmAssignment =
    "globalThis.setImmediate=nodeTimers.setImmediate=patchedSetImmediate,globalThis.clearImmediate=nodeTimers.clearImmediate=patchedClearImmediate";
  const already = `try{${setImmAssignment}}catch(_e){}`;
  if (content.includes(setImmAssignment) && !content.includes(already)) {
    content = content.replace(setImmAssignment, already);
    patched = true;
  }

  // Patch 3: node:timers/promises module assignment (also read-only).
  // The original is a comma-expression: `a=b,process.nextTick=c`
  // Wrapping just `a=b` breaks the comma chain, so we replace the whole thing.
  const timersPromisesChain =
    "nodeTimersPromises.setImmediate=patchedSetImmediatePromise,process.nextTick=patchedNextTick";
  if (content.includes(timersPromisesChain) && !content.includes(`try{nodeTimersPromises`)) {
    content = content.replace(
      timersPromisesChain,
      "try{nodeTimersPromises.setImmediate=patchedSetImmediatePromise}catch(_e){};process.nextTick=patchedNextTick"
    );
    patched = true;
  }

  if (patched) {
    fs.writeFileSync(HANDLER_PATH, content, "utf-8");
    console.log("[global-setup] Applied Workers test-env patches to handler.mjs");
  }
}
