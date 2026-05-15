"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Safari doesn't always check for SW updates automatically —
        // calling update() on each load ensures deploys propagate promptly
        registration.update().catch(() => {});
      })
      .catch(console.error);
  }, []);

  return null;
}
