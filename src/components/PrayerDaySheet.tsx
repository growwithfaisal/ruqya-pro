"use client";
import Link from "next/link";
import { clock, dayRows, methodLabel, until, type DayRow, type Place, type PrayerPrefs } from "@/lib/prayer";
import { Sheet } from "./Sheet";

function Row({ r, now }: { r: DayRow; now: Date }) {
  const marker = r.name === "Sunrise";
  const active = r.state === "now";
  const dim = r.state === "past" || (marker && !active);
  return (
    <li
      aria-current={active ? "time" : undefined}
      className={`flex min-h-16 items-center justify-between gap-4 border-b border-line px-1 py-2.5 ${active ? "rounded-2xl border-transparent bg-[color-mix(in_oklch,var(--accent)_16%,transparent)] px-4" : ""}`}
    >
      <span className="grid">
        <span className={`${marker ? "text-lead" : "display text-title"} leading-tight ${dim ? "text-card-soft" : ""}`}>{r.name}</span>
        {active && <span className="text-meta font-semibold">Now</span>}
        {r.state === "next" && <span className="text-meta text-card-soft">Next, in <span className="tabular">{until(r.at, now)}</span></span>}
      </span>
      <span className={`tabular text-title leading-none ${dim ? "text-card-soft" : ""}`}>{clock(r.at)}</span>
    </li>
  );
}

/** Every prayer time for today, opened by a long press (or the "All times" button) on Home's prayer card. */
export function PrayerDaySheet({
  open, onOpenChange, place, prefs, now,
}: { open: boolean; onOpenChange: (o: boolean) => void; place: Place; prefs: PrayerPrefs; now: Date }) {
  const view = dayRows(place, prefs, now);
  const how = methodLabel(prefs);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Prayer times"
      description={now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
    >
      {view ? (
        <ol className="border-t border-line">
          {view.rows.map((r) => <Row key={r.name} r={r} now={now} />)}
          {view.tomorrowFajr && (
            <li className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-1 py-2.5">
              <span className="grid">
                <span className="display text-title leading-tight">Fajr</span>
                <span className="text-meta text-card-soft">Tomorrow, in <span className="tabular">{until(view.tomorrowFajr.at, now)}</span></span>
              </span>
              <span className="tabular text-title leading-none">{clock(view.tomorrowFajr.at)}</span>
            </li>
          )}
        </ol>
      ) : (
        <p className="border-t border-line pt-4 text-card-soft">The sun does not give clear prayer times at this place today. Choose another method in Settings.</p>
      )}
      <div className="mt-5 grid gap-1 text-small text-card-soft">
        <p>Method: {how.method}. Asr: {how.asr}.</p>
        <p>
          Worked out on this device.{" "}
          <Link href="/settings#prayer-settings-title" onClick={() => onOpenChange(false)} className="text-card-ink underline">Change the method in Settings</Link>
        </p>
      </div>
    </Sheet>
  );
}
