"use client";
import { useEffect } from "react";
import { ACCOUNTS_CONFIGURED, syncIfNeeded, syncSoon } from "@/lib/account";

/**
 * Keeps a signed-in reader's progress in step across devices: when the app opens or comes back to the front, when the
 * connection returns, and a little while after progress changes. Does nothing for a reader who has not signed in.
 */
export function AccountSync() {
  useEffect(() => {
    if (!ACCOUNTS_CONFIGURED) return;
    const t = window.setTimeout(() => { void syncIfNeeded(); }, 3500); // after the page has settled
    const back = () => { if (document.visibilityState === "visible") void syncIfNeeded(); };
    const online = () => { void syncIfNeeded(); };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("online", online);
    window.addEventListener("rp-quran", syncSoon);
    window.addEventListener("rp-progress", syncSoon);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("online", online);
      window.removeEventListener("rp-quran", syncSoon);
      window.removeEventListener("rp-progress", syncSoon);
    };
  }, []);
  return null;
}
