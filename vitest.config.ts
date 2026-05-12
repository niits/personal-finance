import { defineConfig } from "vitest/config";
import path from "path";
import { readFileSync } from "fs";

const firebase = JSON.parse(readFileSync(path.resolve(__dirname, "firebase.json"), "utf8"));
const firestorePort: number = firebase.emulators.firestore.port;
const authPort: number = firebase.emulators.auth.port;

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 15_000,
    env: {
      FIRESTORE_EMULATOR_HOST: `localhost:${firestorePort}`,
      FIREBASE_AUTH_EMULATOR_HOST: `localhost:${authPort}`,
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
