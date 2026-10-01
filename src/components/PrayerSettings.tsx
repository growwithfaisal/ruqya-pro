"use client";
import { useState } from "react";
import { METHODS, LocateError, forgetPlace, locate, setPrayerPrefs, suggestedMethod, usePrayerState, type MethodId } from "@/lib/prayer";

const field = "field";

export function PrayerSettings() {
  const { place, prefs } = usePrayerState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LocateError | null>(null);
  const suggested = METHODS.find((m) => m.id === suggestedMethod())?.label;

  const update = async () => {
    setBusy(true);
    setError(null);
    try { await locate(); } catch (e) { setError(e as LocateError); }
    setBusy(false);
  };

  return (
    <section aria-labelledby="prayer-settings-title">
      <h2 id="prayer-settings-title" className="t-h2">Prayer times</h2>
      <p className="mt-2 max-w-[56ch] text-ink-soft">
        Worked out on this device from the sun&apos;s position at your location, so they work with no internet. They can differ by a few minutes from your local mosque; choose the method it follows if you know it.
      </p>

      <div className="mt-4 border-t border-line">
        <label className="grid gap-2 border-b border-line py-4">
          <span>Calculation method</span>
          <select value={prefs.method} onChange={(e) => setPrayerPrefs({ method: e.target.value as MethodId })} className={field}>
            <option value="auto">Automatic{suggested ? ` (${suggested})` : ""}</option>
            {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="grid gap-2 border-b border-line py-4">
          <span>Asr time</span>
          <select value={prefs.asr} onChange={(e) => setPrayerPrefs({ asr: e.target.value as "standard" | "hanafi" })} className={field}>
            <option value="standard">Standard (Shafi&apos;i, Maliki, Hanbali)</option>
            <option value="hanafi">Hanafi</option>
          </select>
        </label>
        <div className="grid gap-3 border-b border-line py-4">
          <p>
            Location:{" "}
            <span className="text-ink-soft">{place ? `saved on this device (${place.lat.toFixed(2)}, ${place.lon.toFixed(2)})` : "not set"}</span>
          </p>
          {error && <p role="alert" className="text-small">{error === "denied" ? "Location is off for this app. Allow it in your phone's settings, then try again." : "Your location could not be found. Try again."}</p>}
          <div className="flex flex-wrap gap-3">
            <button onClick={update} disabled={busy} className="btn btn-sm btn-secondary">
              {busy ? "Finding you…" : place ? "Update my location" : "Use my location"}
            </button>
            {place && <button onClick={forgetPlace} className="btn btn-sm btn-secondary">Forget my location</button>}
          </div>
        </div>
      </div>
    </section>
  );
}
