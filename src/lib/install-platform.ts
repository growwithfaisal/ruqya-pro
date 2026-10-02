/**
 * Which kind of device and browser is this, as far as adding the app to the Home Screen goes? Pure, so it can be tested with
 * real user-agent strings (scripts/check-install.mts).
 *
 * What each can do:
 *  - Android Chrome, Samsung Internet, Edge and desktop Chrome / Edge: the browser lets a page offer to install, so one tap does it.
 *  - iPhone, iPad and Mac Safari: Apple gives pages no way to do this. The reader must use the Share menu themselves, so we show
 *    them exactly where to tap.
 *  - Inside another app's browser (Instagram, Facebook, TikTok...): nothing can be installed from there; they must open the site
 *    in Safari or Chrome first.
 */
export type Platform =
  | "ios-phone"
  | "ios-tablet"
  | "mac-safari"
  | "android-chromium"
  | "android-other"
  | "desktop-chromium"
  | "inapp"
  | "other";

export interface Env { ua: string; platform: string; touchPoints: number; screenMin: number }

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|Pinterest|LinkedInApp|GSA\//;

export function detectPlatform({ ua, platform, touchPoints, screenMin }: Env): Platform {
  const iPhone = /iPhone|iPod/.test(ua);
  const iPad = /iPad/.test(ua) || (platform === "MacIntel" && touchPoints > 1); // iPadOS asks for desktop sites by default
  if (iPhone || iPad) {
    // A page shown inside another app (or any web view) has no "Safari/" in its user agent, and the real browsers all do.
    if (IN_APP.test(ua) || !/Safari\//.test(ua)) return "inapp";
    return iPad && !iPhone ? "ios-tablet" : "ios-phone";
  }
  if (/Android/.test(ua)) {
    if (IN_APP.test(ua) || /; wv\)/.test(ua)) return "inapp";
    return /Chrome\/|SamsungBrowser|EdgA|OPR\//.test(ua) ? "android-chromium" : "android-other";
  }
  const safari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox|FxiOS/.test(ua);
  if (safari && touchPoints <= 1) {
    const v = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
    return v >= 17 ? "mac-safari" : "other"; // "Add to Dock" arrived in Safari 17 (macOS Sonoma)
  }
  if (/Chrome\/|Edg\//.test(ua) && !/Mobile/.test(ua)) return "desktop-chromium";
  void screenMin;
  return "other";
}

/** True where the browser can show its own install dialog when the page asks (once it has said the app is installable). */
export const hasNativeInstall = (p: Platform) => p === "android-chromium" || p === "desktop-chromium";
/** True where the reader has to do it from the browser's menu and we can only show how. */
export const needsGuide = (p: Platform) => p === "ios-phone" || p === "ios-tablet" || p === "mac-safari" || p === "android-other";

export interface Step { text: string; hint?: string; icon: "share" | "add" | "more" | "dock" | "menu" | "open" | "check" }

/** The steps to show, in plain words, for each place the reader has to do it themselves. */
export function stepsFor(p: Platform): { title: string; blurb: string; steps: Step[]; where: "bottom" | "top" } | null {
  switch (p) {
    case "ios-phone":
      return {
        title: "Add RuqyaPro to your Home Screen",
        blurb: "Three taps, and it is on your phone.",
        where: "bottom",
        steps: [
          { icon: "share", text: "Tap the Share button", hint: "The square with an arrow, at the bottom of Safari. On newer iPhones tap the ••• button first, then Share." },
          { icon: "add", text: "Tap “Add to Home Screen”", hint: "Scroll down in the list that opens to find it." },
          { icon: "check", text: "Tap “Add”", hint: "RuqyaPro now sits with your other apps. Open it from there." },
        ],
      };
    case "ios-tablet":
      return {
        title: "Add RuqyaPro to your Home Screen",
        blurb: "Three taps, and it is on your iPad.",
        where: "top",
        steps: [
          { icon: "share", text: "Tap the Share button", hint: "The square with an arrow, at the top of Safari next to the address." },
          { icon: "add", text: "Tap “Add to Home Screen”", hint: "Scroll down in the list that opens to find it." },
          { icon: "check", text: "Tap “Add”", hint: "RuqyaPro now sits with your other apps. Open it from there." },
        ],
      };
    case "mac-safari":
      return {
        title: "Keep RuqyaPro in your Dock",
        blurb: "Three clicks, and it is in your Dock.",
        where: "top",
        steps: [
          { icon: "dock", text: "Open the File menu", hint: "At the very top of your screen, next to Safari." },
          { icon: "add", text: "Choose “Add to Dock”", hint: "Or click the Share button in the toolbar and choose it there." },
          { icon: "check", text: "Click “Add”", hint: "RuqyaPro opens in its own window from your Dock. Progress saved in Safari does not move over by itself." },
        ],
      };
    case "android-other":
    case "android-chromium":
      return {
        title: "Add RuqyaPro to your Home Screen",
        blurb: "Three taps, and it is on your phone.",
        where: "top",
        steps: [
          { icon: "more", text: "Tap the menu button", hint: "Three dots (⋮) at the top right of your browser." },
          { icon: "add", text: "Tap “Add to Home screen” or “Install app”", hint: "The wording depends on your phone." },
          { icon: "check", text: "Tap “Add” or “Install”", hint: "RuqyaPro now sits with your other apps. Open it from there." },
        ],
      };
    case "inapp":
      return {
        title: "Open RuqyaPro in your browser first",
        blurb: "Do this once, then come back to this page.",
        where: "top",
        steps: [
          { icon: "menu", text: "Tap the menu button", hint: "Three dots (•••) or the share icon, usually at the top or bottom of this screen." },
          { icon: "open", text: "Tap “Open in Safari” or “Open in browser”", hint: "This page is inside another app, which cannot add RuqyaPro to your Home Screen." },
          { icon: "check", text: "Then follow the prompt you will see there", hint: "It will show you how to add it." },
        ],
      };
    default:
      return null;
  }
}
