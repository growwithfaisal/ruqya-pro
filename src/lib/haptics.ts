"use client";

/**
 * A light tap for the moments that matter: a page that turns, a card that is ticked, the day's goal, a sheet let go.
 *
 * Android and other browsers with the Vibration API get a short vibration. iPhone Safari has no such API; it plays the
 * system haptic only when a native switch (`<input type="checkbox" switch>`) is toggled.
 *  - iOS 18 to 26.4: a hidden switch toggled from script, inside the user's own event, ticks (iosTap below).
 *  - iOS 26.5 and later: Apple stopped script-triggered ticks. Only a real finger landing on a switch ticks, so the
 *    reader's buttons carry an invisible one (HapticSwitch). Swipes and drags cannot tick there.
 * Where nothing works nothing happens, and nothing depends on it: every moment that taps is also shown on screen.
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

/** iPhone or iPad (iPadOS reports a Mac with touch). */
export const isAppleTouch = () =>
  typeof navigator !== "undefined" && (/iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

/** A real switch was just tapped and iOS played its own tick: skip the tap the action would add in code. */
export function noteNativeTap() {
  last = Date.now();
}

export function haptic(ms = 10) {
  // One tap per moment: a page turn that also ticks a card should not buzz twice.
  const now = Date.now();
  if (now - last < 80) return;
  last = now;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function" && navigator.vibrate(ms)) return;
  } catch {}
  try {
    if (isAppleTouch()) iosTap();
  } catch {}
}
