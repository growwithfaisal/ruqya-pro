"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import type { Entry, TimeTag } from "@/lib/types";
import { SETS, citation } from "@/lib/entries";
import { tajweedForEntry } from "@/lib/quran";
import { setPrefs, useQuran } from "@/lib/quran-store";
import { doneKey, useDone } from "@/lib/progress";
import { ArabicSizeControl } from "./ArabicSizeControl";
import { CitationBadge, DraftNotice } from "./CitationBadge";
import { Coloured } from "./Coloured";
import { Check, Chevron } from "./Glyphs";
import { Sheet } from "./Sheet";

type Panel = null | "list" | "settings";
const SWIPE = 80;

/** A daily set (morning, evening, bedtime) read one card at a time, in the same frame as the Qur'an reader. */
export function RoutineReader({ set, entries }: { set: TimeTag; entries: Entry[] }) {
  const reduce = useReducedMotion();
  const { done, markDone, clear } = useDone();
  const q = useQuran();
  const dragged = useRef(false);

  const [i, setI] = useState(0);
  // Once the on-device record is readable, start at the first card not yet recited today.
  const [ready, setReady] = useState(false);
  const placed = useRef(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!ready || placed.current) return;
    placed.current = true;
    const firstOpen = entries.findIndex((x) => !done.has(doneKey(set, x.id)));
    if (firstOpen > 0) setI(firstOpen);
  }, [ready, done, entries, set]);
  const [dir, setDir] = useState(1);
  const [finished, setFinished] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState("");
  const [tg, setTg] = useState<[number, number, number][] | null>(null);

  const e = entries[i];
  const left = entries.filter((x) => !done.has(doneKey(set, x.id))).length;

  // Tajweed colours, when this card is a run of Qur'an verses that the data can match exactly.
  useEffect(() => {
    let live = true;
    setTg(null);
    if (e) tajweedForEntry(e.arabic, [e.source, ...e.support]).then((r) => live && setTg(r)).catch(() => {});
    return () => { live = false; };
  }, [e]);

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote((t) => (t === text ? "" : t)), 2500);
  };

  const go = useCallback(
    (d: 1 | -1) => {
      setDir(d);
      setFinished(false);
      setI((x) => Math.max(0, Math.min(entries.length - 1, x + d)));
    },
    [entries.length],
  );

  const finish = () => {
    if (!e) return;
    markDone(doneKey(set, e.id));
    setDir(1);
    // The routine is complete the moment every card is recited, whatever order they were done in.
    const allDone = entries.every((x) => x.id === e.id || done.has(doneKey(set, x.id)));
    if (allDone) { setFinished(true); return; }
    // Otherwise go on to the next open card, wrapping round to the first one left.
    const after = entries.findIndex((x, k) => k > i && !done.has(doneKey(set, x.id)));
    const first = entries.findIndex((x) => x.id !== e.id && !done.has(doneKey(set, x.id)));
    setI(after >= 0 ? after : first >= 0 ? first : i);
  };

  const share = async () => {
    const url = `${location.origin}/recitations/${e.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: e.title, url });
      else { await navigator.clipboard.writeText(url); flash("Link copied"); }
    } catch {}
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (panel || (ev.target instanceof HTMLElement && ev.target.closest("input, textarea"))) return;
      if (ev.key === "ArrowRight") go(1);
      if (ev.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, panel]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setTimeout(() => (dragged.current = false), 0);
    if (info.offset.x < -SWIPE || info.velocity.x < -500) go(1);
    else if (info.offset.x > SWIPE || info.velocity.x > 500) go(-1);
  };

  const lines = useMemo(() => (e ? e.arabic.split("\n") : []), [e]);
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 340, damping: 32, mass: 0.9 };
  const isDone = e ? done.has(doneKey(set, e.id)) : false;

  if (!entries.length) return <p className="mt-24 text-center text-ink-soft">Nothing in this routine yet.</p>;

  if (finished) {
    const open = entries.filter((x) => !done.has(doneKey(set, x.id)));
    return (
      <div className="mx-auto grid min-h-[calc(100dvh-8rem)] max-w-2xl place-content-center gap-5 px-6 text-center">
        <p className="display text-[clamp(2rem,7vw,2.8rem)] leading-tight">{open.length === 0 ? `${SETS[set]} complete.` : "That was the last card."}</p>
        <p className="text-ink-soft">
          {open.length === 0
            ? `${entries.length} of ${entries.length} recited today. Kept on this device only.`
            : `${entries.length - open.length} of ${entries.length} recited today. ${open.length} ${open.length === 1 ? "card is" : "cards are"} still open.`}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {open.length > 0 ? (
            <button onClick={() => { setFinished(false); setDir(-1); setI(entries.findIndex((x) => !done.has(doneKey(set, x.id)))); }} className="min-h-12 rounded-full bg-accent px-6 font-semibold text-accent-ink">Open the first one</button>
          ) : (
            <button onClick={() => { clear(entries.map((x) => doneKey(set, x.id))); setFinished(false); setDir(-1); setI(0); }} className="min-h-12 rounded-full border border-line px-5">Start again</button>
          )}
          <Link href="/" className="grid min-h-12 place-items-center rounded-full border border-line px-6 no-underline">Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-2xl flex-col px-4 pb-36 pt-5 md:px-8 md:pt-8">
      <p className="text-center text-[0.95rem] text-ink-soft tabular" aria-live="polite">
        {SETS[set]} · {left === 0 ? "all recited today" : `${left} left`}
      </p>

      <div className="relative mt-3">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.section
            key={e.id}
            custom={dir}
            aria-label={`${e.title}, card ${i + 1} of ${entries.length}`}
            className="touch-pan-y rounded-[28px] border border-line bg-card text-card-ink shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]"
            variants={{
              enter: (d: number) => ({ x: reduce ? 0 : d * 70, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: reduce ? 0 : d * -90, opacity: 0, transition: { duration: reduce ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] } }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={spring}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragStart={() => (dragged.current = true)}
            onDragEnd={onDragEnd}
          >
            <header className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 px-3 pt-4">
              <button onClick={() => setPanel("list")} aria-label="See all cards in this routine" className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h10" /></svg>
              </button>
              <button onClick={() => setPanel("list")} aria-label={`Card ${i + 1} of ${entries.length}. See all cards`} className="min-h-12 rounded-2xl text-center">
                <span className="display block text-[1.3rem] leading-tight">{e.title}</span>
                <span className="block text-[0.95rem] text-card-soft tabular">{i + 1}/{entries.length}</span>
              </button>
              <span
                role="img"
                aria-label={isDone ? "Recited today" : "Not recited yet"}
                className={`grid size-11 place-items-center rounded-full ${isDone ? "bg-accent text-accent-ink" : "border border-line text-card-soft"}`}
              >
                <Check size={20} />
              </span>
            </header>

            <div className="max-h-[46dvh] overflow-y-auto px-5 py-5">
              {lines.map((l, k) => (
                <p key={k} lang="ar" dir="rtl" className="arabic arabic-read !text-center">
                  {lines.length === 1 && q.prefs.tajweed && tg
                    ? <Coloured ar={l.trim()} ranges={tg} lead={l.length - l.trimStart().length} />
                    : l.trim()}
                </p>
              ))}
            </div>

            <footer className="flex items-center justify-between gap-2 px-3 pb-3">
              <button onClick={share} aria-label={`Share ${e.title}`} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 5l6 6-6 6M20 11H9a5 5 0 0 0-5 5v2" /></svg>
              </button>
              <CitationBadge entry={e} />
              <button onClick={() => setPanel("settings")} aria-label="Reading settings" className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full border border-line text-[1.05rem]">Aa</button>
            </footer>
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="mt-6 text-center">
        {e.repeat && <p className="mb-3"><span className="rounded-full border border-line px-3.5 py-1.5 text-[0.95rem]">{e.repeat}</span></p>}
        {q.prefs.translit && (
          e.transliteration
            ? <div className="text-[clamp(1.25rem,4.6vw,1.55rem)] leading-snug">{e.transliteration.split("\n").map((l, k) => <p key={k}>{l}</p>)}</div>
            : <p className="text-[0.95rem] text-[var(--draft)]">Transliteration pending a cited source.</p>
        )}
        {q.prefs.translation && (
          <div className={`mx-auto max-w-[60ch] leading-relaxed ${q.prefs.translit ? "mt-4 text-[1.02rem] text-ink-soft" : "text-[1.2rem]"}`}>
            {e.translation.split("\n").map((l, k) => <p key={k}>{l}</p>)}
          </div>
        )}
        {e.practice && <p className="mx-auto mt-4 max-w-[52ch] text-[0.95rem] text-ink-soft">{e.practice}</p>}
        <DraftNotice entry={e} className="mx-auto mt-4 max-w-[52ch]" />
        <p className="mt-4 text-[0.9rem] text-ink-soft">
          <Link href={`/recitations/${e.slug}`} className="underline">Read in full</Link> · {citation(e)}
        </p>
      </div>

      {note && (
        <p role="status" className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 mx-auto w-fit rounded-full bg-accent px-4 py-2 text-[0.95rem] font-semibold text-accent-ink shadow-[0_8px_24px_-8px_rgb(0_0_0/0.4)]">
          {note}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3" style={{ background: "linear-gradient(180deg, transparent, var(--sky-bottom) 40%)" }}>
        <div className="mx-auto grid max-w-2xl grid-cols-[1fr_1.7fr_1fr] gap-3">
          <button onClick={() => go(-1)} disabled={i === 0} aria-label="Previous card" className="grid min-h-14 place-items-center rounded-full border border-line bg-card text-card-ink disabled:opacity-40">
            <Chevron className="rotate-180" size={24} />
          </button>
          <button onClick={finish} className="min-h-14 rounded-full bg-accent text-[1.1rem] font-semibold text-accent-ink transition-transform active:scale-[0.98]">I&apos;m Done</button>
          <button onClick={() => go(1)} disabled={i === entries.length - 1} aria-label="Next card" className="grid min-h-14 place-items-center rounded-full bg-ink text-[var(--sky-bottom)] disabled:opacity-40">
            <Chevron size={24} />
          </button>
        </div>
      </div>

      <Sheet open={panel === "list"} onOpenChange={(o) => setPanel(o ? "list" : null)} title={SETS[set]} description="Tap a card to go to it.">
        <ul className="grid gap-2 pt-1">
          {entries.map((x, k) => (
            <li key={x.id}>
              <button
                onClick={() => { setDir(k >= i ? 1 : -1); setI(k); setPanel(null); }}
                aria-current={k === i ? "true" : undefined}
                className={`flex min-h-14 w-full items-center gap-3 rounded-[20px] border px-4 text-left ${k === i ? "border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_14%,transparent)]" : "border-line"}`}
              >
                <span className="tabular w-6 text-card-soft">{k + 1}</span>
                <span className="display flex-1 text-[1.15rem] leading-tight">{x.title}</span>
                {done.has(doneKey(set, x.id)) && <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-ink"><Check size={16} /></span>}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={panel === "settings"} onOpenChange={(o) => setPanel(o ? "settings" : null)} title="Reading" description="Saved on this device only.">
        {([["translit", "Transliteration"], ["translation", "Translation"], ["tajweed", "Tajweed colours (Qur'an verses)"]] as const).map(([k, label]) => (
          <label key={k} className="flex min-h-14 items-center justify-between border-b border-line">
            <span>{label}</span>
            <input type="checkbox" role="switch" checked={q.prefs[k]} onChange={(ev) => setPrefs({ [k]: ev.target.checked })} className="size-6 accent-[var(--accent)]" />
          </label>
        ))}
        <div className="flex min-h-16 items-center justify-between border-b border-line">
          <span>Arabic size</span>
          <ArabicSizeControl />
        </div>
      </Sheet>
    </div>
  );
}
