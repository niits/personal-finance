import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: [
      "tests/integration/ledger-schema.test.ts",
      "tests/integration/ledger-service.test.ts",
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: "2026-04-01",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          vars: {
            BETTER_AUTH_SECRET: "test-secret-vitest-do-not-use-in-production",
          },
        },
      },
    },
  },
});
