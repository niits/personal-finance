"use client";

import { useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { getClientAuth, getDB } from "@/lib/firebase-client";
import { seedNewUser } from "@/lib/data/seed";
import { notFound } from "next/navigation";

// Guard: this page must never be accessible in production.
// The NEXT_PUBLIC_ var is inlined at build time — if unset, notFound() runs on mount.
const IS_EMULATOR = Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR);

export const TEST_USER_EMAIL = "e2e-test@example.com";
export const TEST_USER_PASSWORD = "e2e-password-123";

export default function TestSignInPage() {
  const router = useRouter();

  useEffect(() => {
    if (!IS_EMULATOR) {
      notFound();
      return;
    }

    const auth = getClientAuth();
    const db = getDB();

    signInWithEmailAndPassword(auth, TEST_USER_EMAIL, TEST_USER_PASSWORD)
      .then(async (cred) => {
        await seedNewUser(db, cred.user.uid);
        router.push("/dashboard");
      })
      .catch(() =>
        createUserWithEmailAndPassword(auth, TEST_USER_EMAIL, TEST_USER_PASSWORD).then(
          async (cred) => {
            await seedNewUser(db, cred.user.uid);
            router.push("/dashboard");
          },
        ),
      );
  }, [router]);

  return (
    <div style={{ padding: 24, fontFamily: "monospace" }}>
      Signing in for E2E tests…
    </div>
  );
}
