"use client";

import { useEffect, useState } from "react";
import {
  onIdTokenChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { getClientAuth, getDB, googleProvider } from "./firebase-client";
import { seedNewUser } from "./data/seed";

export type ClientSession = {
  user: { id: string; email: string | null; name: string | null };
};

export function useSession(): { data: ClientSession | null; isPending: boolean } {
  const [data, setData] = useState<ClientSession | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    const unsub = onIdTokenChanged(getClientAuth(), (user: User | null) => {
      setData(
        user
          ? { user: { id: user.uid, email: user.email, name: user.displayName } }
          : null,
      );
      setIsPending(false);
    });
    return () => unsub();
  }, []);

  return { data, isPending };
}

export async function signInWithGoogle(): Promise<void> {
  const cred = await signInWithPopup(getClientAuth(), googleProvider);
  // Idempotent first-sign-in seed. Safe to call on every login (cheap no-op when seeded).
  await seedNewUser(getDB(), cred.user.uid);
}

export async function signOut(): Promise<void> {
  await fbSignOut(getClientAuth());
}

// For AI routes: send the current user's ID token in Authorization header.
export async function getIdToken(): Promise<string | null> {
  const user = getClientAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}
