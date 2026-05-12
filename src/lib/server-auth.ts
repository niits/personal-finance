// Server-side auth for AI routes only. Verifies a Firebase ID token
// passed as `Authorization: Bearer <token>` and returns the uid.
import { adminAuth } from "./firebase-admin";

export async function requireUid(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}
