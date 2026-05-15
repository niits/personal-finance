import { getUserId, wipeUserData, seedUserData, type SeedLevel } from "./db-reset";

export { TEST_EMAIL } from "./global-setup";

/** Wipes and re-seeds the test user's app data directly via D1. Call in `beforeAll` of each spec file. */
export async function resetTestData(seed: SeedLevel = "minimal"): Promise<void> {
  const userId = getUserId("e2e@test.local");
  wipeUserData(userId);
  seedUserData(userId, seed);
}
