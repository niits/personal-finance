// Server-side (admin SDK) Firestore reference helpers.
// Used only by AI routes which need to read user data while bypassing rules.
import { adminDB } from "./firebase-admin";

export const userDoc = (uid: string) => adminDB.collection("users").doc(uid);
export const txCol = (uid: string) => userDoc(uid).collection("transactions");
export const categoryCol = (uid: string) => userDoc(uid).collection("categories");
export const aiRunCol = (uid: string) => userDoc(uid).collection("aiSuggestionRuns");
