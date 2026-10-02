"use client";
import { setNight, useNight } from "@/lib/night";
import { HalfDisc } from "./Glyphs";

/** The header's night-mode switch: outlined while off, tinted with the accent while on. */
export function NightButton() {
  const night = useNight();
  return (
    <button
      type="button"
      onClick={() => setNight(!night)}
      aria-pressed={night}
      aria-label="Night mode"
      className={`grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-full border transition-colors duration-300 ${
        night ? "border-transparent bg-[color-mix(in_oklch,var(--accent)_26%,transparent)] text-accent" : "border-line"
      }`}
    >
      <HalfDisc />
    </button>
  );
}

/** The Settings row for the same switch. */
export function NightSwitch() {
  const night = useNight();
  return (
    <label className="flex min-h-16 items-center justify-between gap-4 border-y border-line py-3">
      <span className="grid min-w-0">
        <span>Night mode</span>
        <span className="text-meta text-ink-soft">Keeps the app in its night colours until you turn it off. Off, it follows the sun at your place.</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={night}
        onChange={(e) => setNight(e.target.checked)}
        className="size-6 shrink-0 accent-[var(--accent)]"
      />
    </label>
  );
}
