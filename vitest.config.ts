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
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    globalSetup: ["./tests/integration/global-setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
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
