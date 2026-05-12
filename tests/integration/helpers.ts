import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Firestore } from "firebase/firestore";

export { assertFails, assertSucceeds };

const ROOT = resolve(__dirname, "../..");
const firebase = JSON.parse(readFileSync(resolve(ROOT, "firebase.json"), "utf8"));

export async function setupTestEnvironment(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: "demo-personal-finance",
    firestore: {
      host: "localhost",
      port: firebase.emulators.firestore.port,
      rules: readFileSync(resolve(ROOT, "firestore.rules"), "utf8"),
    },
  });
}

// Get an authenticated Firestore instance for a given UID.
// Cast is safe: the emulator returns an API-compatible Firestore object.
export function authenticatedDb(env: RulesTestEnvironment, uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

export function unauthenticatedDb(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

// Generate a unique UID for each test so data never overlaps.
export function uid(): string {
  return `u-${Math.random().toString(36).slice(2, 10)}`;
}
