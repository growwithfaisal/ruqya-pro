// Checks which device each user agent is taken for when offering to add the app to the Home Screen.
// Run: npx tsx scripts/check-install.mts
import assert from "node:assert/strict";
import { detectPlatform, hasNativeInstall, needsGuide, stepsFor, type Platform } from "../src/lib/install-platform";

let n = 0, bad = 0;
const cases: [string, string, { platform?: string; touch?: number }, Platform][] = [
  ["iPhone Safari 17", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", { touch: 5 }, "ios-phone"],
  ["iPhone Safari 26", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1", { touch: 5 }, "ios-phone"],
  ["iPhone Chrome", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1", { touch: 5 }, "ios-phone"],
  ["iPhone Firefox", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15", { touch: 5 }, "ios-phone"],
  ["iPhone Instagram", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 330.0.0.35.108 (iPhone14,5; iOS 17_5; en_US)", { touch: 5 }, "inapp"],
  ["iPhone Facebook", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 [FBAN/FBIOS;FBAV/460.0.0.34.108;FBBV/59;FBDV/iPhone14,5]", { touch: 5 }, "inapp"],
  ["iPhone plain web view", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", { touch: 5 }, "inapp"],
  ["iPad Safari (mobile site)", "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1", { touch: 5 }, "ios-tablet"],
  ["iPad Safari (desktop site)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", { platform: "MacIntel", touch: 5 }, "ios-tablet"],
  ["Mac Safari 17", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", { platform: "MacIntel", touch: 0 }, "mac-safari"],
  ["Mac Safari 26", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15", { platform: "MacIntel", touch: 0 }, "mac-safari"],
  ["Mac Safari 16 (cannot add to Dock)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15", { platform: "MacIntel", touch: 0 }, "other"],
  ["Mac Chrome", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", { platform: "MacIntel", touch: 0 }, "desktop-chromium"],
  ["Windows Edge", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0", { platform: "Win32", touch: 0 }, "desktop-chromium"],
  ["Windows Firefox", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0", { platform: "Win32", touch: 0 }, "other"],
  ["Android Chrome", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36", { platform: "Linux armv81", touch: 5 }, "android-chromium"],
  ["Samsung Internet", "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36", { platform: "Linux armv81", touch: 5 }, "android-chromium"],
  ["Android Edge", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.0.0", { platform: "Linux armv81", touch: 5 }, "android-chromium"],
  ["Android Firefox", "Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0", { platform: "Linux armv81", touch: 5 }, "android-other"],
  ["Android Facebook", "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.0;]", { platform: "Linux armv81", touch: 5 }, "inapp"],
  ["Android web view", "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36", { platform: "Linux armv81", touch: 5 }, "inapp"],
  ["Android TikTok", "Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 trill_2023 TikTok", { platform: "Linux armv81", touch: 5 }, "inapp"],
  ["Linux Chrome", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", { platform: "Linux x86_64", touch: 0 }, "desktop-chromium"],
];

for (const [name, ua, extra, want] of cases) {
  try {
    assert.equal(detectPlatform({ ua, platform: extra.platform ?? "iPhone", touchPoints: extra.touch ?? 0, screenMin: 390 }), want, name);
    n++;
  } catch (e) { bad++; console.error("FAIL", name, (e as Error).message); }
}

try {
  // Native one-tap only where the browser supports it; a guide wherever the reader must do it themselves; nothing for the rest.
  for (const p of ["android-chromium", "desktop-chromium"] as Platform[]) assert.equal(hasNativeInstall(p), true);
  for (const p of ["ios-phone", "ios-tablet", "mac-safari", "android-other"] as Platform[]) { assert.equal(hasNativeInstall(p), false); assert.equal(needsGuide(p), true); }
  for (const p of ["inapp", "other", "desktop-chromium"] as Platform[]) assert.equal(needsGuide(p), false);
  // Every guide has three plain steps, and the right place for the Share button.
  for (const p of ["ios-phone", "ios-tablet", "mac-safari", "android-other", "android-chromium", "inapp"] as Platform[]) assert.equal(stepsFor(p)!.steps.length, 3, p);
  assert.equal(stepsFor("ios-phone")!.where, "bottom");
  assert.equal(stepsFor("ios-tablet")!.where, "top");
  assert.equal(stepsFor("other"), null);
  assert.equal(stepsFor("desktop-chromium"), null);
  n++;
} catch (e) { bad++; console.error("FAIL guides", (e as Error).message); }

console.log(`${n} checks passed${bad ? `, ${bad} FAILED` : ""}`);
process.exit(bad ? 1 : 0);
