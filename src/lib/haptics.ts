"use client";

/**
 * A light tap for the moments that matter: a page that turns, a card that is ticked, the day's goal, a sheet let go.
 *
 * Android and other browsers with the Vibration API get a short vibration. iPhone Safari has no such API, but since
 * Safari 18 it plays the system haptic when a native switch (`<input type="checkbox" switch>`) is toggled, so a hidden
 * one is toggled through its label in the same user gesture. Where neither works nothing happens, and nothing else
 * depends on it: every moment that taps is also shown on screen. Call it from inside the event (see iosTap).
 */
/**
 * The iPhone tap, in the form known to work: a fresh hidden switch, clicked through its label, then removed. It must run
 * inside the touch event that caused it (a click, a pointerup); Safari stays silent for one started from a timer or an
 * animation frame, so callers that learn of a gesture late (framer's drag end) decide at the pointerup instead.
 */
function iosTap() {
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
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
    if (/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) && "ontouchend" in document) iosTap();
  } catch {}
}
