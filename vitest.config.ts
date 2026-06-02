import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import type { Plugin } from "vite";
import path from "path";

// Stub node:inspector — Next.js's console-dim.external.js imports it at startup
// but it's not available in the Cloudflare Workers runtime. The module is only
// used to suppress console output during dev, so an empty stub is safe.
function stubNodeInspector(): Plugin {
  return {
    name: "stub-node-inspector",
    resolveId(id) {
      if (id === "node:inspector") return "\0node:inspector-stub";
    },
    load(id) {
      if (id === "\0node:inspector-stub") {
        return `export default {}; export function open() {} export function close() {} export class Session {}`;
      }
    },
  };
}

export default defineWorkersConfig({
  plugins: [stubNodeInspector()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The pre-built Next.js bundle requires `node:os`, which the pool's workerd
      // cannot resolve from the dynamically-required bundle. Map it to a stub so
      // Vite bundles a working module in its place (works in real wrangler dev).
      "node:os": path.resolve(__dirname, "tests/integration/node-os-stub.cjs"),
    },
  },
  test: {
    globalSetup: ["./tests/integration/global-setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    // Routes are compiled on-demand inside workerd, so the first request to each
    // distinct route is slow (the heavy Next.js bundle). The default 5s is not
    // enough; give each test room for a cold route compile.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Match the production runtime. workerd only registers some node:
          // builtins (e.g. node:os, required transitively by next/dist/server)
          // when the compat date is recent enough; without pinning it here the
          // pool falls back to an older default and route tests fail with
          // `No such module "node:os"`.
          compatibilityDate: "2026-04-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          vars: {
            BETTER_AUTH_SECRET: "test-secret-vitest-do-not-use-in-production",
            BETTER_AUTH_URL: "http://localhost",
            GITHUB_CLIENT_ID: "test-client-id",
            GITHUB_CLIENT_SECRET: "test-client-secret",
          },
        },
      },
    },
  },
});
