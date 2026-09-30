"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import type { Entry, Intent, TimeTag } from "@/lib/types";
import { INTENTS, SETS } from "@/lib/entries";
import { useDone } from "@/lib/progress";
import { CitationBadge, DraftNotice, GradeBadge } from "./CitationBadge";
import { ArabicSizeControl } from "./ArabicSizeControl";
import { Check, Chevron } from "./Glyphs";

type Filter = { intent: Intent | "all"; set: TimeTag | "" };

const SWIPE = 90;

export function Deck({ entries, initial }: { entries: Entry[]; initial: Filter }) {
  const reduce = useReducedMotion();
  const { done, toggle, clear } = useDone();
  const [filter, setFilter] = useState<Filter>(initial);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [flipped, setFlipped] = useState(false);
  const dragged = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const list = useMemo(
    () =>
      entries.filter(
        (e) => (filter.intent === "all" || e.category.includes(filter.intent)) && (!filter.set || e.times.includes(filter.set)),
      ),
    [entries, filter],
  );
  const complete = list.length > 0 && list.every((e) => done.has(e.id));
  const atEnd = index >= list.length;
  const current = list[index];

  const applyFilter = (f: Filter) => {
    setFilter(f);
    setIndex(0);
    setFlipped(false);
    const q = new URLSearchParams();
    if (f.intent !== "all") q.set("intent", f.intent);
    if (f.set) q.set("set", f.set);
    history.replaceState(null, "", q.size ? `?${q}` : location.pathname);
  };

  const go = useCallback(
    (d: 1 | -1) => {
      setDir(d);
      setFlipped(false);
      setIndex((i) => Math.max(0, Math.min(list.length, i + d)));
    },
    [list.length],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest("button, a, input")) return;
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setTimeout(() => (dragged.current = false), 0);
    if (info.offset.x < -SWIPE || info.velocity.x < -500) go(1);
    else if (info.offset.x > SWIPE || info.velocity.x > 500) go(-1);
  };

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 340, damping: 32, mass: 0.9 };

  return (
    <div ref={root} onKeyDown={onKey} className="mx-auto max-w-5xl px-4 pb-6 pt-6 md:px-8">
      {/* Filters */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="group" aria-label="Filter recitations">
        {([{ id: "all", label: "All" }, ...INTENTS] as { id: Filter["intent"]; label: string }[]).map((c) => (
          <button
            key={c.id}
            aria-pressed={filter.intent === c.id && !filter.set}
            onClick={() => applyFilter({ intent: c.id, set: "" })}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-[0.95rem] transition-colors ${filter.intent === c.id && !filter.set ? "border-transparent bg-ink text-[var(--sky-bottom)]" : "border-line"}`}
          >
            {c.label}
          </button>
        ))}
        {filter.set && (
          <button aria-pressed className="min-h-11 shrink-0 rounded-full border border-transparent bg-accent px-4 text-[0.95rem] text-accent-ink" onClick={() => applyFilter({ intent: "all", set: "" })}>
            {SETS[filter.set]} ✕
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <p className="mt-16 text-center text-ink-soft">Nothing to show here yet.</p>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between text-[0.92rem] text-ink-soft">
            <p aria-live="polite" className="tabular">
              {atEnd ? "Set complete" : `${index + 1} of ${list.length}`}
              <span className="ml-3">{list.filter((e) => done.has(e.id)).length} recited today</span>
            </p>
            <ArabicSizeControl />
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-roledescription="carousel"
            aria-label="Recitation cards. Use the left and right arrow keys, or swipe."
            className="relative mx-auto mt-3 w-full max-w-[26rem] outline-offset-8 md:max-w-[30rem]"
            style={{ perspective: 1400 }}
          >
            {/* the stack behind */}
            <div aria-hidden className="pointer-events-none absolute inset-0 top-3 mx-3 rounded-[50%_50%_28px_28px/150px_150px_28px_28px] border border-line bg-card opacity-60" />
            <div aria-hidden className="pointer-events-none absolute inset-0 top-6 mx-6 rounded-[50%_50%_28px_28px/150px_150px_28px_28px] border border-line bg-card opacity-30" />

            <div className="relative h-[clamp(28rem,calc(100dvh-17rem),44rem)]">
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.div
                  key={atEnd ? "end" : current.id}
                  custom={dir}
                  className="absolute inset-0 touch-pan-y"
                  variants={{
                    enter: (d: number) => ({ x: reduce ? 0 : d * 90, opacity: 0, scale: 0.97 }),
                    center: { x: 0, opacity: 1, scale: 1, rotate: 0 },
                    exit: (d: number) => ({ x: reduce ? 0 : d * -120, opacity: 0, rotate: reduce ? 0 : d * -4, transition: { duration: reduce ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] } }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={spring}
                  drag={atEnd ? false : "x"}
                  dragDirectionLock
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.7}
                  onDragStart={() => (dragged.current = true)}
                  onDragEnd={onDragEnd}
                  whileDrag={{ rotate: 0 }}
                >
                  {atEnd ? (
                    <EndCard complete={complete} onRestart={() => { clear(list.map((e) => e.id)); setIndex(0); setDir(-1); }} onBack={() => go(-1)} />
                  ) : (
                    <Card
                      entry={current}
                      flipped={flipped}
                      setFlipped={setFlipped}
                      isDone={done.has(current.id)}
                      onDone={() => toggle(current.id)}
                      dragged={dragged}
                      reduce={!!reduce}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="mx-auto mt-5 flex max-w-[26rem] items-center justify-between md:max-w-[30rem]">
            <button onClick={() => go(-1)} disabled={index === 0} className="min-h-12 rounded-full border border-line px-5 disabled:opacity-40">Previous</button>
            <span className="text-[0.85rem] text-ink-soft">Swipe or use the buttons</span>
            <button onClick={() => go(1)} disabled={atEnd} className="min-h-12 rounded-full border border-line px-5 disabled:opacity-40">Next</button>
          </div>
        </>
      )}
    </div>
  );
}

function Card({
  entry, flipped, setFlipped, isDone, onDone, dragged, reduce,
}: {
  entry: Entry; flipped: boolean; setFlipped: (v: boolean) => void; isDone: boolean; onDone: () => void;
  dragged: React.RefObject<boolean>; reduce: boolean;
}) {
  const lines = entry.arabic.split("\n");
  const tlLines = entry.transliteration.split("\n");
  const enLines = entry.translation.split("\n");
  const shape = "rounded-[50%_50%_28px_28px/150px_150px_28px_28px]";
  const face = `absolute inset-0 flex flex-col overflow-hidden ${shape} border border-line bg-card text-card-ink shadow-[0_24px_48px_-20px_rgb(0_0_0/0.35),0_2px_0_0_rgb(255_255_255/0.06)_inset]`;

  return (
    <motion.div
      className="relative h-full w-full"
      style={{ transformStyle: "preserve-3d" }}
      animate={{ rotateY: flipped ? 180 : 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 28 }}
    >
      {/* FRONT */}
      <div className={face} style={{ backfaceVisibility: "hidden" }} aria-hidden={flipped} inert={flipped}>
        <div className="px-8 pt-[4.5rem] text-center">
          <h2 className="display text-[1.35rem] leading-tight">{entry.title}</h2>
          <div className="mt-2 flex justify-center"><span className="text-accent"><GradeBadge entry={entry} /></span></div>
        </div>
        <div
          className="mt-2 flex-1 overflow-y-auto px-6 pb-4"
          onClick={() => { if (!dragged.current) setFlipped(true); }}
          title="Tap for details"
        >
          <div className="pt-1">
            {lines.map((l, i) => (
              <p key={i} lang="ar" dir="rtl" className="arabic">{l.trim()}</p>
            ))}
          </div>
          {entry.transliteration ? (
            <div className="mt-4 text-center text-[0.98rem] italic leading-relaxed text-card-soft">
              {tlLines.map((l, i) => <p key={i}>{l}</p>)}
            </div>
          ) : (
            <p className="mt-4 text-center text-[0.9rem] text-[var(--draft)]">Transliteration pending a cited source.</p>
          )}
          <div className="mt-4 text-center text-[1.02rem] leading-relaxed">
            {enLines.map((l, i) => <p key={i}>{l}</p>)}
          </div>
          <div className="mt-4"><DraftNotice entry={entry} /></div>
        </div>
        <div className="grid gap-2 border-t border-line px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <CitationBadge entry={entry} />
            <button onClick={() => setFlipped(true)} className="min-h-11 shrink-0 rounded-full px-3 text-[0.9rem] underline">Details</button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onDone}
              aria-pressed={isDone}
              className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full font-semibold transition-colors active:scale-[0.98] ${isDone ? "bg-accent text-accent-ink" : "border border-line"}`}
            >
              {isDone && <Check />}
              {isDone ? "Recited today" : "Mark as recited"}
            </button>
            <Link href={`/recitations/${entry.slug}`} className="flex min-h-12 shrink-0 items-center whitespace-nowrap rounded-full border border-line px-4 no-underline">Read in full</Link>
          </div>
        </div>
      </div>

      {/* BACK */}
      <div className={face} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }} aria-hidden={!flipped} inert={!flipped}>
        <div className="px-8 pt-[4.5rem] text-center">
          <h2 className="display text-[1.35rem] leading-tight">{entry.title}</h2>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto px-7 pb-4 text-[0.98rem] leading-relaxed">
          <dl className="grid gap-4">
            <div><dt className="text-[0.85rem] text-card-soft">How</dt><dd>{entry.practice}</dd></div>
            {entry.repeat && <div><dt className="text-[0.85rem] text-card-soft">How many times</dt><dd>{entry.repeat}</dd></div>}
            <div>
              <dt className="text-[0.85rem] text-card-soft">Source</dt>
              <dd>{entry.source.book} {entry.source.ref}<span className="block text-card-soft">{entry.source.chapter}</span></dd>
            </div>
            <div><dt className="text-[0.85rem] text-card-soft">Graded by</dt><dd>{entry.grader || "Not yet recorded"}</dd></div>
          </dl>
          <div className="mt-4"><DraftNotice entry={entry} /></div>
        </div>
        <div className="grid gap-2 border-t border-line px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <CitationBadge entry={entry} />
            <Link href={`/recitations/${entry.slug}`} className="min-h-11 shrink-0 content-center whitespace-nowrap rounded-full px-3 text-[0.9rem] underline">Read in full</Link>
          </div>
          <button onClick={() => setFlipped(false)} className="min-h-12 rounded-full border border-line font-semibold">Back to the text</button>
        </div>
      </div>
    </motion.div>
  );
}

function EndCard({ complete, onRestart, onBack }: { complete: boolean; onRestart: () => void; onBack: () => void }) {
  return (
    <div className="absolute inset-0 grid place-content-center gap-5 rounded-[50%_50%_28px_28px/150px_150px_28px_28px] border border-line bg-card px-10 pt-24 text-center text-card-ink">
      <h2 className="display text-[1.8rem] leading-tight">{complete ? "Set complete." : "End of the set."}</h2>
      <p className="text-card-soft">{complete ? "Every card in this set is marked as recited today." : "Some cards are not marked as recited yet."}</p>
      <div className="flex justify-center gap-3">
        <button onClick={onBack} className="min-h-12 rounded-full border border-line px-5">Go back</button>
        <button onClick={onRestart} className="min-h-12 rounded-full bg-accent px-5 font-semibold text-accent-ink">Start again</button>
      </div>
    </div>
  );
}

export { Chevron };
