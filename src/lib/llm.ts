import { getApp, initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
import type { Schema } from "firebase/ai";

// Named secondary app — server-side only, no auth/firestore emulator wiring needed.
function getAIApp() {
  try {
    return getApp("ai");
  } catch {
    return initializeApp(
      {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      },
      "ai",
    );
  }
}

export function getModel(opts: {
  systemInstruction?: string;
  responseSchema?: Schema;
}) {
  const ai = getAI(getAIApp(), { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}),
    ...(opts.responseSchema
      ? {
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: opts.responseSchema,
          },
        }
      : {}),
  });
}
