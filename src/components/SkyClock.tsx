"use client";
import { useEffect } from "react";
import { THEME_COLOR } from "@/lib/sky";
import { liveSky, writeSkyCache } from "@/lib/sky-live";

/**
 * Keeps the sky in step with the device clock while the app stays open. A home-screen app can sit in the
 * background for hours, so the sky is re-read every minute and whenever the app returns to the front.
 * A `?sky=` preview in the address bar is left alone.
 */
export function SkyClock() {
  useEffect(() => {
    const preview = new URLSearchParams(location.search).get("sky");

    let cachedFor = "";
    const tick = () => {
      if (!preview) {
        const now = new Date();
        const { sky, timeline } = liveSky(now);
        // Keep today's sky times where the pre-paint script can read them.
        const stamp = `${now.toLocaleDateString("en-CA")}|${timeline ? "real" : "fixed"}`;
        if (stamp !== cachedFor) { cachedFor = stamp; writeSkyCache(timeline, now); }
        if (document.documentElement.dataset.sky !== sky) {
          document.documentElement.dataset.sky = sky;
          document.querySelector("meta[name=theme-color]")?.setAttribute("content", THEME_COLOR[sky]);
        }
      }
      // "Recited today" is keyed by the local date; nudge listeners so it rolls over at midnight.
      window.dispatchEvent(new Event("rp-progress"));
    };

    const onVisible = () => {
      const visible = document.visibilityState === "visible";
      document.documentElement.classList.toggle("rp-hidden", !visible); // pauses the sky's drift while hidden
      if (visible) tick();
    };
    const onPlace = () => { cachedFor = ""; tick(); }; // the reader changed their place or method
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", tick);
    window.addEventListener("focus", tick);
    window.addEventListener("rp-prayer", onPlace);
    tick();
    return () => {
      window.removeEventListener("rp-prayer", onPlace);
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", tick);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return null;
}
