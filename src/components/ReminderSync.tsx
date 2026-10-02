"use client";
import { useEffect } from "react";
import { REMINDERS_CONFIGURED, queueSync, syncIfNeeded } from "@/lib/reminders";

/**
 * Keeps the reminder schedule current while the app is used: refreshed when the app opens (if the list is old or running low),
 * and again when the reader's place or prayer method changes, since prayer times move with them.
 */
export function ReminderSync() {
  useEffect(() => {
    if (!REMINDERS_CONFIGURED) return;
    const t = window.setTimeout(() => { void syncIfNeeded(); }, 3000); // after the page has settled
    const onVisible = () => document.visibilityState === "visible" && void syncIfNeeded();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("rp-prayer", queueSync);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("rp-prayer", queueSync);
    };
  }, []);
  return null;
}
