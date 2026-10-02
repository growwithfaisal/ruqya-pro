"use client";
import { useEffect, useState } from "react";
import { detectPlatform, hasNativeInstall, needsGuide, type Platform } from "./install-platform";

/**
 * Offering to add the app to the Home Screen. Where the browser allows it (Android Chrome, Samsung Internet, Edge, desktop Chrome)
 * one tap on our button opens the browser's own install dialog. Where it does not (iPhone, iPad, Mac Safari) we show the steps.
 * The browser's "this site can be installed" event can arrive before the page's code runs, so layout.tsx catches it early and
 * keeps it on window.__rpInstall.
 */
const KEY = "rp:v1:install"; // { dismissed?: ms, installed?: true }
const EVENT = "rp-install";
const COOLDOWN = 7 * 86_400_000; // after "Not now", leave the reader alone for a week

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
declare global { interface Window { __rpInstall?: InstallEvent | null } }

export type Phase = "checking" | "hidden" | "native" | "guide" | "inapp";

const stored = (): { dismissed?: number; installed?: boolean } => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
};
const save = (patch: object) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...stored(), ...patch })); } catch {}
  window.dispatchEvent(new Event(EVENT));
};

export function currentPlatform(): Platform {
  return detectPlatform({ ua: navigator.userAgent, platform: navigator.platform, touchPoints: navigator.maxTouchPoints, screenMin: Math.min(screen.width, screen.height) });
}

function isInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches || stored().installed === true;
}

/** Asks the browser to show its install dialog (only possible where it offered). */
export async function installNow(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const e = window.__rpInstall;
  if (!e) return "unavailable";
  try {
    await e.prompt();
    const choice = await e.userChoice;
    window.__rpInstall = null; // each offer can be used once
    if (choice.outcome === "accepted") save({ installed: true });
    else window.dispatchEvent(new Event(EVENT));
    return choice.outcome;
  } catch {
    return "unavailable";
  }
}

export const dismissInstall = () => save({ dismissed: Date.now() });

/** What to show this reader. `respectNotNow` is false in Settings, which always shows the option while the app is not installed. */
export function useInstall(respectNotNow = true): { phase: Phase; platform: Platform } {
  const [state, setState] = useState<{ phase: Phase; platform: Platform }>({ phase: "checking", platform: "other" });

  useEffect(() => {
    let wait: ReturnType<typeof setTimeout> | undefined;
    const evaluate = () => {
      clearTimeout(wait);
      const platform = currentPlatform();
      const set = (phase: Phase) => setState({ phase, platform });
      if (isInstalled()) return set("hidden");
      if (respectNotNow && Date.now() - (stored().dismissed ?? 0) < COOLDOWN) return set("hidden");
      if (platform === "inapp") return set("inapp");
      if (hasNativeInstall(platform)) {
        if (window.__rpInstall) return set("native");
        if (platform === "android-chromium") {
          // Chrome may still be deciding, or may have already used up its offer: show the steps if nothing arrives.
          set("checking");
          wait = setTimeout(() => { if (!window.__rpInstall) set("guide"); }, 4000);
          return;
        }
        return set("hidden"); // desktop Chrome that is not offering: nothing we can do
      }
      set(needsGuide(platform) ? "guide" : "hidden");
    };
    evaluate();
    window.addEventListener(EVENT, evaluate);
    return () => { clearTimeout(wait); window.removeEventListener(EVENT, evaluate); };
  }, [respectNotNow]);

  return state;
}
