"use client";
import { useEffect, useState } from "react";
import { daylight, nominalDaylight } from "@/lib/daylight";
import { LocateError, clock, locate, prayerNow, refreshPlaceQuietly, until, usePrayerState } from "@/lib/prayer";

const ERRORS: Record<LocateError, string> = {
  denied: "Location is off for this app. Allow it in your phone's settings, then try again.",
  timeout: "Your location took too long to answer. Try again.",
  unavailable: "Your location could not be found. Try again.",
};

/** Current prayer, its time, and the wait for the next. Worked out on the device from where the reader is. */
export function PrayerTimes() {
  const { place, prefs, ready } = usePrayerState();
  const [now, setNow] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LocateError | null>(null);

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

  const shell = "mx-auto max-w-5xl px-4 pt-14 md:px-8 md:pt-20";
  const card = "rounded-[28px] border border-white/25 px-5 py-5 shadow-[0_24px_48px_-24px_rgb(10_14_40/0.55)]";

  if (!ready || !now) {
    return (
      <section aria-label="Prayer times" className={shell}>
        <div className="mx-auto max-w-2xl"><div className={`${card} min-h-[8.25rem] glass`} aria-hidden /></div>
      </section>
    );
  }

  const t = place ? prayerNow(place, prefs, now) : null;
  // The card's own sky: blends from the colour of the prayer now running to the next as the minutes pass.
  const sky = t ? daylight(t.current.name, t.next.name, t.progress) : nominalDaylight(now);
  const skin = { background: sky.background, color: sky.color };

  return (
    <section aria-labelledby="prayer-title" className={shell}>
      <div className="mx-auto max-w-2xl">
        <h2 id="prayer-title" className="sr-only">Prayer times</h2>
        {t ? (
          <div className={card} style={skin}>
            <div className="flex items-baseline justify-between gap-4">
              <p className="display text-[clamp(2rem,8vw,2.75rem)] leading-none">{t.current.name}</p>
              <p className="tabular text-[clamp(1.35rem,5.5vw,1.75rem)] leading-none">{clock(t.current.at)}</p>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklch,currentColor_26%,transparent)]" aria-hidden>
              <div className="h-full rounded-full bg-current transition-[width] duration-700" style={{ width: `${Math.round(t.progress * 100)}%` }} />
            </div>
            <p className="mt-3 text-base">
              {t.next.name} in <span className="tabular font-semibold">{until(t.next.at, now)}</span>
            </p>
          </div>
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
      </div>
    </section>
  );
}
