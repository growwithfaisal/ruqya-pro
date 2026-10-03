"use client";
import { useSyncExternalStore } from "react";
import { isAppleTouch, noteNativeTap } from "@/lib/haptics";

const never = () => () => {};

/**
 * Gives a button iPhone's haptic tick on iOS 26.5 and later, where a tick can no longer be started from code: an
 * invisible native switch covers the button, so the finger lands on it and iOS ticks, and the click carries on to the
 * button's own handler. Put it last inside a `relative` button. Hidden from screen readers and the tab order (the
 * button keeps its name, focus and keys); disabled with the button; only rendered on iPhone and iPad.
 */
export function HapticSwitch({ disabled = false }: { disabled?: boolean }) {
  const apple = useSyncExternalStore(never, isAppleTouch, () => false);
  if (!apple) return null;
  return (
    <input
      ref={(el) => el?.setAttribute("switch", "")}
      type="checkbox"
      aria-hidden="true"
      tabIndex={-1}
      disabled={disabled}
      onClick={() => noteNativeTap()}
      className="absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0"
    />
  );
}
