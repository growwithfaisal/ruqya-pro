"use client";

/**
 * A light tap for the moments that matter: a page that turns, a card that is ticked, the day's goal, a sheet let go.
 *
 * Android and other browsers with the Vibration API get a short vibration. iPhone Safari has no such API, but since
 * Safari 18 it plays the system haptic when a native switch (`<input type="checkbox" switch>`) is toggled, so a hidden
 * one is toggled through its label in the same user gesture. Where neither works nothing happens, and nothing else
 * depends on it: every moment that taps is also shown on screen.
 */
let label: HTMLLabelElement | null = null;

function iosSwitch(): HTMLLabelElement | null {
  if (label?.isConnected) return label;
  try {
    const l = document.createElement("label");
    l.setAttribute("aria-hidden", "true");
    l.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    l.appendChild(input);
    document.body.appendChild(l);
    label = l;
    return l;
  } catch {
    return null;
  }
}

let last = 0;

export function haptic(ms = 10) {
  // One tap per moment: a page turn that also ticks a card should not buzz twice.
  const now = Date.now();
  if (now - last < 80) return;
  last = now;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function" && navigator.vibrate(ms)) return;
  } catch {}
  try {
    if (/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && "ontouchend" in document) iosSwitch()?.click();
  } catch {}
}
