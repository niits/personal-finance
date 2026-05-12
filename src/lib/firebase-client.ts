"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  connectAuthEmulator,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
};

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;

export function getClientApp(): FirebaseApp {
  if (!app) app = getApps()[0] ?? initializeApp(firebaseConfig);
  return app;
}

export function getClientAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getClientApp());
    const emu = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR;
    if (emu) connectAuthEmulator(authInstance, emu, { disableWarnings: true });
  }
  return authInstance;
}

export function getDB(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getClientApp());
    const emu = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR;
    if (emu) {
      const [host, port] = emu.split(":");
      connectFirestoreEmulator(dbInstance, host, Number(port));
    }
  }
  return dbInstance;
}

export const googleProvider = new GoogleAuthProvider();
