"use client";
import { useEffect } from "react";
import { decimalHour, skyForHour, THEME_COLOR } from "@/lib/sky";

/**
 * Keeps the sky in step with the device clock while the app stays open. A home-screen app can sit in the
 * background for hours, so the sky is re-read every minute and whenever the app returns to the front.
 * A `?sky=` preview in the address bar is left alone.
 */
export function SkyClock() {
  useEffect(() => {
    const preview = new URLSearchParams(location.search).get("sky");

    const tick = () => {
      if (!preview) {
        const sky = skyForHour(decimalHour());
        if (document.documentElement.dataset.sky !== sky) {
          document.documentElement.dataset.sky = sky;
          document.querySelector("meta[name=theme-color]")?.setAttribute("content", THEME_COLOR[sky]);
        }
      }
      // "Recited today" is keyed by the local date; nudge listeners so it rolls over at midnight.
      window.dispatchEvent(new Event("rp-progress"));
    };

    const onVisible = () => document.visibilityState === "visible" && tick();
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return null;
}
