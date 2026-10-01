"use client";
import { useEffect } from "react";
import { downloadEverything, readRecord } from "@/lib/offline";

/**
 * Keeps the offline copy current. If someone has downloaded everything and a newer version of the app has since been
 * deployed, the copy is quietly refreshed the next time the app is opened with a connection.
 */
export function OfflineSync() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const rec = readRecord();
    const build = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
    if (!rec || rec.build === build || !navigator.onLine) return;
    // Wait for the page to settle first.
    const t = window.setTimeout(() => { downloadEverything(rec.urls, () => {}).catch(() => {}); }, 4000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
