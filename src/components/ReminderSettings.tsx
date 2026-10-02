"use client";
import Link from "next/link";
import { useState } from "react";
import { usePrayerState } from "@/lib/prayer";
import {
  REMINDERS_CONFIGURED, disable, enable, savePrefs, sendTest, useReminders,
  type EnableResult,
} from "@/lib/reminders";
import {
  ADHKAR_LABEL, PRAYER_LABEL, type AdhkarKey, type Lead, type PrayerKey, type ReminderPrefs,
} from "@/lib/reminder-schedule";

const PRAYERS = Object.keys(PRAYER_LABEL) as PrayerKey[];
const SETS = Object.keys(ADHKAR_LABEL) as AdhkarKey[];
const LEADS: [Lead, string][] = [[0, "At the time"], [5, "5 minutes before"], [10, "10 minutes before"], [15, "15 minutes before"], [30, "30 minutes before"]];

const row = "flex min-h-14 items-center justify-between gap-4 border-b border-line";
const timeInput = "field !w-auto !min-h-11 px-4 tabular";

const FAILED: Record<string, string> = {
  denied: "Notifications are off for RuqyaPro. Allow them in your phone's settings, then try again.",
  install: "Reminders need RuqyaPro on your Home Screen. Tap Share, then Add to Home Screen, and open it from there.",
  "unsupported-browser": "This browser cannot show reminders.",
  unsupported: "This browser cannot show reminders.",
  network: "The reminder service could not be reached. Check your connection and try again.",
  full: "Reminders are full right now. Please try again later.",
  rejected: "Your phone's notification service did not accept this. Try again in a moment.",
  busy: "Please wait a few seconds and try again.",
  "no-subscription": "This phone is not set up for reminders yet. Turn them on again.",
};
const STOPPED: Record<string, string> = {
  permission: "Notifications were turned off for RuqyaPro in your phone's settings, so reminders stopped.",
  network: "Your reminders could not be updated just now. They will be tried again the next time you open the app.",
  full: "Reminders could not be updated because the service is full. They will be tried again later.",
  rejected: "Your reminders could not be updated. They will be tried again the next time you open the app.",
};

const untilText = (ms?: number) => (ms ? new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "long" }) : "");

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`${row} ${disabled ? "opacity-60" : ""}`}>
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-6 shrink-0 accent-[var(--accent)]" />
    </label>
  );
}

function TimeRow({ label, on, time, onOn, onTime }: { label: string; on: boolean; time: string; onOn: (v: boolean) => void; onTime: (t: string) => void }) {
  return (
    <div className={`${row} flex-wrap py-2`}>
      <label className="flex min-h-11 flex-1 items-center justify-between gap-4">
        <span>{label}</span>
        <input type="checkbox" role="switch" checked={on} onChange={(e) => onOn(e.target.checked)} className="size-6 shrink-0 accent-[var(--accent)]" />
      </label>
      {on && <input type="time" value={time} onChange={(e) => e.target.value && onTime(e.target.value)} aria-label={`${label} time`} className={timeInput} />}
    </div>
  );
}

export function ReminderSettings() {
  const { prefs, meta, support } = useReminders();
  const { place } = usePrayerState();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (!REMINDERS_CONFIGURED) return null;

  const set = (patch: Partial<ReminderPrefs>) => savePrefs({ ...prefs, ...patch });
  const nothing = !(Object.values(prefs.prayers).some(Boolean) && place) && !Object.values(prefs.adhkar).some((a) => a.on) && !prefs.friday.on && !prefs.ayat.on;

  const toggle = async (on: boolean) => {
    setBusy(true);
    setNote("");
    if (on) {
      const r: EnableResult = await enable();
      if (r !== "ok") setNote(FAILED[r] ?? FAILED.network);
    } else {
      await disable();
    }
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    const r = await sendTest();
    setNote(r === "ok" ? "A test reminder is on its way." : r === "wait" ? "A test was sent a moment ago. Try again in a few minutes." : r === "off" ? "Reminders are not on for this phone." : FAILED.network);
    setBusy(false);
  };

  const blocked = support === "checking" ? null : support === "install" ? FAILED.install : support === "unsupported" ? FAILED["unsupported-browser"] : support === "denied" ? FAILED.denied : null;

  return (
    <section aria-labelledby="reminders-title">
      <h2 id="reminders-title" className="t-h2">Reminders</h2>
      <p className="mt-2 max-w-[56ch] text-ink-soft">
        A gentle notification for the prayers, the daily adhkar, Friday&apos;s Surah Al-Kahf and, if you like, two verses a day. You choose each one and its time.
      </p>

      <div className="mt-4 border-t border-line">
        <Switch label="Reminders" checked={prefs.on} onChange={toggle} disabled={busy || support === "checking" || (!prefs.on && !!blocked)} />
      </div>
      {blocked && !prefs.on && <p role="status" className="mt-3 max-w-[56ch] text-small">{blocked}</p>}
      {!prefs.on && meta.err && STOPPED[meta.err] && <p role="status" className="mt-3 max-w-[56ch] text-small">{STOPPED[meta.err]}</p>}
      {note && <p role="status" aria-live="polite" className="mt-3 max-w-[56ch] text-small">{note}</p>}

      <p className="mt-4 max-w-[56ch] text-small text-ink-soft">
        To send reminders, a small server keeps a private address for this phone and the times you chose. It does not keep your location, your name, what you read, or which verses are picked, but the times can show roughly which part of the world you are in. Turning reminders off deletes it.
      </p>

      {prefs.on && (
        <div className="mt-8 grid gap-8">
          <div>
            <h3 className="display text-title leading-tight">Prayers</h3>
            {place ? (
              <div className="mt-3 border-t border-line">
                {PRAYERS.map((k) => (
                  <Switch key={k} label={PRAYER_LABEL[k]} checked={prefs.prayers[k]} onChange={(v) => set({ prayers: { ...prefs.prayers, [k]: v } })} />
                ))}
                <label className={`${row} flex-wrap py-2`}>
                  <span>When</span>
                  <select value={prefs.lead} onChange={(e) => set({ lead: Number(e.target.value) as Lead })} className="field !w-auto !min-h-11 px-4">
                    {LEADS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </label>
              </div>
            ) : (
              <p className="mt-2 max-w-[56ch] text-small text-ink-soft">
                Prayer reminders need your place. Set it under <Link href="#prayer-settings-title" className="underline">Prayer times</Link>.
              </p>
            )}
          </div>

          <div>
            <h3 className="display text-title leading-tight">Adhkar</h3>
            <div className="mt-3 border-t border-line">
              {SETS.map((k) => (
                <TimeRow
                  key={k}
                  label={ADHKAR_LABEL[k]}
                  on={prefs.adhkar[k].on}
                  time={prefs.adhkar[k].time}
                  onOn={(v) => set({ adhkar: { ...prefs.adhkar, [k]: { ...prefs.adhkar[k], on: v } } })}
                  onTime={(t) => set({ adhkar: { ...prefs.adhkar, [k]: { ...prefs.adhkar[k], time: t } } })}
                />
              ))}
              <TimeRow
                label="Friday: Surah Al-Kahf"
                on={prefs.friday.on}
                time={prefs.friday.time}
                onOn={(v) => set({ friday: { ...prefs.friday, on: v } })}
                onTime={(t) => set({ friday: { ...prefs.friday, time: t } })}
              />
            </div>
          </div>

          <div>
            <h3 className="display text-title leading-tight">Verses</h3>
            <p className="mt-1 max-w-[56ch] text-small text-ink-soft">Two verses a day from the whole Qur&apos;an, in the Saheeh International translation. Tap one to read it.</p>
            <div className="mt-3 border-t border-line">
              <Switch label="Two verses a day" checked={prefs.ayat.on} onChange={(v) => set({ ayat: { ...prefs.ayat, on: v } })} />
              {prefs.ayat.on && (
                <div className={`${row} flex-wrap py-2`}>
                  <span>Times</span>
                  <span className="flex flex-wrap gap-2">
                    {([0, 1] as const).map((i) => (
                      <input
                        key={i}
                        type="time"
                        value={prefs.ayat.times[i]}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const times: [string, string] = [...prefs.ayat.times];
                          times[i] = e.target.value;
                          set({ ayat: { ...prefs.ayat, times } });
                        }}
                        aria-label={`Verse reminder ${i + 1} time`}
                        className={timeInput}
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {nothing && <p role="status" className="max-w-[56ch] text-small">Choose at least one reminder above.</p>}
          <div>
            {meta.until ? <p className="text-small text-ink-soft">Reminders are set until <span className="tabular">{untilText(meta.until)}</span>. They are topped up each time you open the app.</p> : null}
            {meta.err && STOPPED[meta.err] && prefs.on && <p role="status" className="mt-2 max-w-[56ch] text-small">{STOPPED[meta.err]}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={test} disabled={busy} className="btn btn-sm btn-secondary">Send a test</button>
              <button onClick={() => toggle(false)} disabled={busy} className="btn btn-sm btn-secondary">Turn off and delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
