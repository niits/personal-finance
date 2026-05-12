import { initializeApp, getApps, applicationDefault, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function buildApp() {
  if (getApps().length > 0) return getApps()[0];

  const projectId =
    process.env.GCLOUD_PROJECT ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    "demo-personal-finance";

  // Emulator path: no real credentials needed.
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId });
  }

  // Local dev with a service-account JSON.
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saJson) {
    return initializeApp({ credential: cert(JSON.parse(saJson)), projectId });
  }

  // App Hosting / Cloud Run / GCE — use ADC.
  return initializeApp({ credential: applicationDefault(), projectId });
}

const app = buildApp();
export const adminAuth = getAuth(app);
export const adminDB = getFirestore(app);
