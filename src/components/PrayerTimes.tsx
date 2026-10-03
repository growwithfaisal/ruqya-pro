"use client";
import { useEffect, useState } from "react";
import { daylight, nominalDaylight } from "@/lib/daylight";
import { useLongPress } from "@/lib/long-press";
import { LocateError, clock, locate, prayerNow, refreshPlaceQuietly, until, usePrayerState } from "@/lib/prayer";
import { Chevron } from "./Glyphs";
import { PrayerDaySheet } from "./PrayerDaySheet";

const ERRORS: Record<LocateError, string> = {
  denied: "Location is off for this app. Allow it in your phone's settings, then try again.",
  timeout: "Your location took too long to answer. Try again.",
  unavailable: "Your location could not be found. Try again.",
};

/**
 * Current prayer, its time, and the wait for the next. Worked out on the device from where the reader is.
 * Held down (or tapped on "All times"), it opens the whole day's times. It sits inside the Home hero, which places it.
 */
export function PrayerTimes() {
  const { place, prefs, ready } = usePrayerState();
  const [now, setNow] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LocateError | null>(null);
  const [all, setAll] = useState(false);
  const press = useLongPress(() => setAll(true));

  useEffect(() => {
    setNow(new Date());
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 20_000);
    const wake = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", tick);
    window.addEventListener("rp-progress", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", tick); window.removeEventListener("rp-progress", tick); };
  }, []);

  useEffect(() => { if (place) refreshPlaceQuietly(place); }, [place?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const find = async () => {
    setBusy(true);
    setError(null);
    try { await locate(); } catch (e) { setError(e as LocateError); }
    setBusy(false);
  };

  const card = "rounded-[28px] border border-white/25 px-5 py-5 short:py-3.5 shadow-[0_24px_48px_-24px_rgb(10_14_40/0.55)]";

  if (!ready || !now) {
    return (
      <section aria-label="Prayer times">
        <div className={`${card} min-h-[9.25rem] glass`} aria-hidden />
      </section>
    );
  }

  const t = place ? prayerNow(place, prefs, now) : null;
  // The card's own sky: blends from the colour of the prayer now running to the next as the minutes pass.
  const sky = t ? daylight(t.current.name, t.next.name, t.progress) : nominalDaylight(now);
  const skin = { background: sky.background, color: sky.color };

  return (
    <section aria-labelledby="prayer-title">
      <h2 id="prayer-title" className="sr-only">Prayer times</h2>
      {place && t ? (
        <>
          {/* Held down anywhere on the card opens the day's times; the "All times" button is the same thing for taps, keys and screen readers. */}
          <div
            {...press.bind}
            className={`${card} select-none transition-transform duration-200 motion-reduce:transition-none [-webkit-touch-callout:none] ${press.pressing ? "scale-[0.985] motion-reduce:scale-100" : ""}`}
            style={skin}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="display text-[clamp(2rem,8vw,2.75rem)] leading-none short:text-h3">{t.current.name}</p>
              <p className="tabular whitespace-nowrap text-[clamp(1.35rem,5.5vw,1.75rem)] leading-none short:text-title">{clock(t.current.at)}</p>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden short:mt-3 rounded-full bg-[color-mix(in_oklch,currentColor_26%,transparent)]" aria-hidden>
              <div className="h-full rounded-full bg-current transition-[width] duration-700" style={{ width: `${Math.round(t.progress * 100)}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 short:mt-2">
              <p className="text-base">
                {t.next.name} in <span className="tabular font-semibold">{until(t.next.at, now)}</span>
              </p>
              <button
                type="button"
                onClick={() => setAll(true)}
                aria-haspopup="dialog"
                className="-my-2.5 inline-flex min-h-11 items-center gap-0.5 rounded-full border border-[color-mix(in_oklch,currentColor_38%,transparent)] py-1 pl-3.5 pr-2.5 text-meta font-semibold"
              >
                All times <Chevron size={16} />
              </button>
            </div>
          </div>
          <PrayerDaySheet open={all} onOpenChange={setAll} place={place} prefs={prefs} now={now} />
        </>
      ) : (
        <div className={card} style={skin}>
          <p className="display text-h3 leading-tight">Prayer times for where you are</p>
          <p className="mt-1 text-small">
            Your location is used on this device to work out the times. It is never sent anywhere.
          </p>
          {error && <p role="alert" className="mt-3 text-small">{ERRORS[error]}</p>}
          <button
            onClick={find}
            disabled={busy}
            className="btn mt-4 w-full bg-[#fdf8ee] font-semibold text-[#0e1630]"
          >
            {busy ? "Finding you…" : error ? "Try again" : "Show prayer times"}
          </button>
        </div>
      )}
    </section>
  );
}
