"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "framer-motion";
import { MONTH_GOAL, addDays, bestStreak, currentStreak, daysInMonth, localDate, useQuran, weekOf } from "@/lib/quran-store";
import { Book, Calendar, Check, Chevron } from "./Glyphs";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const longDay = (iso: string) => new Date(iso + "T12:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

/** Calendar button, then the month count. Everything it shows is computed from this device's own record. */
export function StreakPill() {
  const q = useQuran();
  const reduce = useReducedMotion();
  const month = daysInMonth(q.days, q.today.slice(0, 7));
  const streak = currentStreak(q.days, q.today);

  return (
    <div className="glass-chip flex items-stretch overflow-hidden rounded-full border border-line">
      <CalendarSheet />
      <div className="flex min-h-14 flex-1 items-center gap-3 border-l border-line px-3.5" aria-live="polite">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"><Book size={20} /></span>
        <motion.span
          key={month}
          initial={reduce ? false : { scale: 1.22 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 18 }}
          className="display tabular text-h3 leading-none"
          aria-label={`${month} of ${MONTH_GOAL} days read this month`}
        >
          {month}/{MONTH_GOAL}
        </motion.span>
        <span className="hidden text-meta text-ink-soft min-[380px]:inline">
          {streak > 0 ? `${streak}-day streak` : "days this month"}
        </span>
      </div>
    </div>
  );
}

/** Monday to Sunday of the current week. */
export function WeekRow() {
  const q = useQuran();
  const days = new Set(q.days);
  return (
    <ol className="glass-chip grid grid-cols-7 gap-1 rounded-full border border-line p-1.5" aria-label="This week">
      {weekOf(q.today).map((d, i) => {
        const read = days.has(d);
        const today = d === q.today;
        const future = d > q.today;
        return (
          <li key={d} className="grid place-items-center">
            <span
              role="img"
              aria-label={`${longDay(d)}${read ? ", read" : today ? ", today" : ""}`}
              className={`grid size-10 place-items-center rounded-full text-small font-semibold transition-colors ${
                read ? "bg-accent text-accent-ink" : future ? "text-ink-soft" : "text-ink"
              } ${today ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent" : ""}`}
            >
              {read ? <Check size={18} /> : LETTERS[i]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CalendarSheet() {
  const q = useQuran();
  const [open, setOpen] = useState(false);
  const [ym, setYm] = useState(localDate().slice(0, 7));
  const days = new Set(q.days);

  const [y, m] = ym.split("-").map(Number);
  const first = `${ym}-01`;
  const lead = (new Date(first + "T12:00").getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const shift = (n: number) => setYm(addDays(`${ym}-15`, n * 30).slice(0, 7));
  const title = new Date(first + "T12:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const isNow = ym === q.today.slice(0, 7);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setYm(localDate().slice(0, 7)); }}>
      <Dialog.Trigger aria-label="Open the reading calendar" className="grid min-h-14 min-w-14 place-items-center">
        <Calendar size={26} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay fixed inset-0 z-40 bg-black/45" />
        <Dialog.Content className="drawer-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col glass-strong rounded-t-[28px] border border-line text-card-ink shadow-[0_-16px_48px_-16px_rgb(0_0_0/0.4)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem] md:rounded-l-[28px] md:rounded-tr-none">
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div>
              <Dialog.Title className="display text-h3 leading-tight">Your reading days</Dialog.Title>
              <Dialog.Description className="mt-1 text-small text-card-soft">
                A day counts after 10 verses. Kept on this device only.
              </Dialog.Description>
            </div>
            <Dialog.Close className="btn btn-sm btn-secondary shrink-0">Close</Dialog.Close>
          </div>

          <div className="overflow-y-auto px-6 pb-8">
            <div className="mt-3 flex items-center justify-between">
              <button onClick={() => shift(-1)} aria-label="Previous month" className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line"><Chevron className="rotate-180" /></button>
              <p className="display text-title">{title}</p>
              <button onClick={() => shift(1)} disabled={isNow} aria-label="Next month" className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line disabled:opacity-30"><Chevron /></button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-y-1.5 text-center" role="grid" aria-label={title}>
              {LETTERS.map((l, i) => <span key={i} className="pb-1 text-meta text-card-soft" aria-hidden>{l}</span>)}
              {Array.from({ length: lead }, (_, i) => <span key={"e" + i} />)}
              {Array.from({ length: count }, (_, i) => {
                const d = `${ym}-${String(i + 1).padStart(2, "0")}`;
                const read = days.has(d);
                return (
                  <span
                    key={d}
                    role="gridcell"
                    aria-label={`${longDay(d)}${read ? ", read" : ""}`}
                    className={`mx-auto grid size-10 place-items-center rounded-full text-small tabular ${
                      read ? "bg-accent font-semibold text-accent-ink" : d > q.today ? "text-card-soft" : ""
                    } ${d === q.today ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--card)]" : ""}`}
                  >
                    {i + 1}
                  </span>
                );
              })}
            </div>

            <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5 text-center">
              {[
                [currentStreak(q.days, q.today), "Day streak"],
                [bestStreak(q.days), "Best streak"],
                [daysInMonth(q.days, q.today.slice(0, 7)), "This month"],
              ].map(([n, label]) => (
                <div key={label as string}>
                  <dd className="display tabular text-[1.8rem] leading-none">{n}</dd>
                  <dt className="mt-1 text-meta text-card-soft">{label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
