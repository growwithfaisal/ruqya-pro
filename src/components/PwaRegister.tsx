"use client";
import { useEffect } from "react";

/** Registers the service worker in production. A new deploy installs a new worker on the next open. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const v = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
    navigator.serviceWorker.register(`/sw.js?v=${v}`).then((reg) => {
      // Ask for the newest worker each time the app is brought back to the front.
      const check = () => document.visibilityState === "visible" && reg.update().catch(() => {});
      document.addEventListener("visibilitychange", check);
    }).catch(() => {});
  }, []);
  return null;
}
