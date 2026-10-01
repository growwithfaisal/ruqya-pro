"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import type { Entry, TimeTag } from "@/lib/types";
import { SETS, citation } from "@/lib/entries";
import { bismillah, chapter, loadSurah, readHref, tajweedForEntry, type Verse } from "@/lib/quran";
import { setPrefs, useQuran } from "@/lib/quran-store";
import { doneKey, useDone } from "@/lib/progress";
import { ArabicSizeControl } from "./ArabicSizeControl";
import { CitationBadge } from "./CitationBadge";
import { Coloured } from "./Coloured";
import { Translit } from "./Translit";
import { Check, Chevron } from "./Glyphs";
import { Sheet } from "./Sheet";

type Panel = null | "list" | "settings";
const SWIPE = 80;

/** One screen of the routine: a whole card, or a single verse of a card that is read verse by verse (Surah Al-Mulk). */
interface Step {
  entry: Entry;
  entryIndex: number;
  verse?: Verse;
  vi?: number;
  vCount?: number;
  surah?: number;
}

const refOf = (e: Entry) => {
  const m = e.source.book === "The Qur'an" ? /^(\d+):(\d+)(?:-(\d+))?$/.exec(e.source.ref) : null;
  return m ? { surah: Number(m[1]), from: Number(m[2]), to: Number(m[3] ?? m[2]) } : null;
};

/** A daily set (morning, evening, bedtime) read one card at a time, in the same frame as the Qur'an reader. */
export function RoutineReader({ set, entries }: { set: TimeTag; entries: Entry[] }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const { done, markDone } = useDone();
  const q = useQuran();
  const dragged = useRef(false);

  // Cards marked verseByVerse are split into one step per verse once their text is on the device.
  const [verseText, setVerseText] = useState<Record<string, Verse[]>>({});
  useEffect(() => {
    let live = true;
    entries.filter((x) => x.verseByVerse).forEach((x) => {
      const r = refOf(x);
      if (!r) return;
      loadSurah(r.surah).then((all) => live && setVerseText((d) => ({ ...d, [x.id]: all.slice(r.from - 1, r.to) }))).catch(() => {});
    });
    return () => { live = false; };
  }, [entries]);

  const steps = useMemo<Step[]>(
    () =>
      entries.flatMap((x, entryIndex) => {
        const vs = x.verseByVerse ? verseText[x.id] : undefined;
        const r = refOf(x);
        return vs && r ? vs.map((verse, vi) => ({ entry: x, entryIndex, verse, vi, vCount: vs.length, surah: r.surah })) : [{ entry: x, entryIndex }];
      }),
    [entries, verseText],
  );

  // The place is kept as (card, verse), so it survives the steps being rebuilt when verse text arrives.
  const [pos, setPos] = useState<{ id: string; vi: number }>({ id: entries[0]?.id ?? "", vi: 0 });
  const found = steps.findIndex((s) => s.entry.id === pos.id && (s.vi ?? 0) === pos.vi);
  const i = found >= 0 ? found : Math.max(0, steps.findIndex((s) => s.entry.id === pos.id));
  const cur = steps[i];
  const e = cur?.entry;
  const open = (x: Entry) => !done.has(doneKey(set, x.id));
  const left = entries.filter(open).length;
  const at = (k: number) => setPos({ id: steps[k].entry.id, vi: steps[k].vi ?? 0 });

  // Once the on-device record is readable, start at the first card not yet recited today.
  const [ready, setReady] = useState(false);
  const placed = useRef(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (!ready || placed.current) return;
    placed.current = true;
    const first = entries.find(open);
    if (first) setPos({ id: first.id, vi: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, done, entries, set]);

  const [dir, setDir] = useState(1);
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState("");
  const [tg, setTg] = useState<[number, number, number][] | null>(null);

  // Tajweed colours for a whole-card Qur'an passage, when the data can match it exactly.
  useEffect(() => {
    let live = true;
    setTg(null);
    if (e && !cur?.verse) tajweedForEntry(e.arabic, [e.source, ...e.support]).then((r) => live && setTg(r)).catch(() => {});
    return () => { live = false; };
  }, [e, cur?.verse]);

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote((t) => (t === text ? "" : t)), 2500);
  };

  // A card counts as recited once the reader has been through all of it: a whole card, or the last verse of a long one.
  const finishedCard = !!cur && (!cur.verse || (cur.vi ?? 0) >= (cur.vCount ?? 1) - 1);

  const go = useCallback(
    (d: 1 | -1) => {
      setDir(d);
      // Moving on from a finished card marks it recited, so finishing a routine needs no extra tap.
      if (d === 1 && finishedCard && cur) markDone(doneKey(set, cur.entry.id));
      const k = Math.max(0, Math.min(steps.length - 1, i + d));
      if (steps[k]) setPos({ id: steps[k].entry.id, vi: steps[k].vi ?? 0 });
    },
    [steps, i, finishedCard, cur, markDone, set],
  );

  // "I'm Done" ends the session: it recites this card if it is finished, then returns to Home.
  const finish = () => {
    if (finishedCard && e) markDone(doneKey(set, e.id));
    router.push("/");
  };

  const share = async () => {
    const url = cur?.verse && cur.surah ? `${location.origin}${readHref(cur.surah, cur.verse.n)}` : `${location.origin}/recitations/${e.slug}`;
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

  const lines = useMemo(() => (cur?.verse ? [cur.verse.ar] : e ? e.arabic.split("\n") : []), [e, cur?.verse]);
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 340, damping: 32, mass: 0.9 };
  const isDone = e ? done.has(doneKey(set, e.id)) : false;

  if (!entries.length || !cur || !e) return <p className="mt-24 text-center text-ink-soft">Nothing in this routine yet.</p>;

  const verse = cur.verse;
  const ch = cur.surah ? chapter(cur.surah) : null;
  const showBismillah = !!verse && verse.n === 1 && !!ch?.bismillahPre;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-2xl flex-col px-4 pb-36 pt-5 short:grid short:min-h-0 short:max-w-none short:grid-cols-2 short:content-start short:gap-x-5 short:pb-20 short:pt-2 md:px-8 md:pt-8">
      <p className="text-center text-small text-ink-soft tabular short:col-span-2" aria-live="polite">
        {SETS[set]} · {left === 0 ? "all recited today" : `${left} left`}
      </p>

      <div className="relative mt-3 short:mt-1">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.section
            key={`${e.id}:${cur.vi ?? 0}`}
            custom={dir}
            aria-label={`${e.title}, card ${cur.entryIndex + 1} of ${entries.length}${verse ? `, verse ${(cur.vi ?? 0) + 1} of ${cur.vCount}` : ""}`}
            className="touch-pan-y glass rounded-[28px] border border-line text-card-ink shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]"
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
              <button onClick={() => setPanel("list")} aria-label={`Card ${cur.entryIndex + 1} of ${entries.length}. See all cards`} className="min-h-12 rounded-[20px] text-center">
                <span className="display block text-title leading-tight">{e.title}</span>
                <span className="block text-small text-card-soft tabular">
                  {verse ? `Verse ${(cur.vi ?? 0) + 1}/${cur.vCount}` : `${cur.entryIndex + 1}/${entries.length}`}
                </span>
              </button>
              <span
                role="img"
                aria-label={isDone ? "Recited today" : "Not recited yet"}
                className={`grid size-11 place-items-center rounded-full ${isDone ? "bg-accent text-accent-ink" : "border border-line text-card-soft"}`}
              >
                <Check size={20} />
              </span>
            </header>

            <div className="max-h-[46dvh] overflow-y-auto px-5 py-5 short:max-h-[calc(100dvh-13rem)] short:py-2">
              {showBismillah && <p lang="ar" dir="rtl" className="arabic mb-2 border-b border-line pb-3 !text-[1.6rem] text-card-soft">{bismillah}</p>}
              {lines.map((l, k) => (
                <p key={k} lang="ar" dir="rtl" className="arabic arabic-read !text-center">
                  {lines.length === 1 && q.prefs.tajweed && (verse?.tg ?? tg)
                    ? <Coloured ar={l.trim()} ranges={(verse?.tg ?? tg)!} lead={l.length - l.trimStart().length} />
                    : l.trim()}
                </p>
              ))}
            </div>

            <footer className="flex items-center justify-between gap-2 px-3 pb-3">
              <button onClick={share} aria-label={`Share ${e.title}`} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 5l6 6-6 6M20 11H9a5 5 0 0 0-5 5v2" /></svg>
              </button>
              <CitationBadge entry={e} />
              <button onClick={() => setPanel("settings")} aria-label="Reading settings" className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full border border-line text-lead">Aa</button>
            </footer>
          </motion.section>
        </AnimatePresence>
      </div>

      <div className="mt-6 text-center short:mt-1 short:max-h-[calc(100dvh-6.5rem)] short:overflow-y-auto">
        {e.repeat && <p className="mb-3"><span className="rounded-full border border-line px-3.5 py-1.5 text-small">{e.repeat}</span></p>}
        {q.prefs.translit && (
          verse
            ? <p className="text-[calc(clamp(1.25rem,4.6vw,1.55rem)*var(--translit-scale))] leading-snug"><Translit text={verse.tr} marks={verse.tu} silent={verse.ts} /></p>
            : e.transliteration
              ? <div className="text-[calc(clamp(1.25rem,4.6vw,1.55rem)*var(--translit-scale))] leading-snug">{e.transliteration.split("\n").map((l, k) => <p key={k}>{e.transliteration.includes("\n") ? l : <Translit text={l} marks={e.tu} silent={e.ts} />}</p>)}</div>
              : <p className="text-small text-[var(--draft)]">Transliteration pending a cited source.</p>
        )}
        {q.prefs.translation && (
          <div className={`mx-auto max-w-[60ch] leading-relaxed ${q.prefs.translit ? "mt-4 text-base text-ink-soft" : "text-[1.2rem]"}`}>
            {(verse ? [verse.en] : e.translation.split("\n")).map((l, k) => <p key={k}>{l}</p>)}
          </div>
        )}
        {e.practice && (!verse || cur.vi === 0) && <p className="mx-auto mt-4 max-w-[52ch] text-small text-ink-soft">{e.practice}</p>}
        <p className="mt-4 text-meta text-ink-soft">
          <Link href={`/recitations/${e.slug}`} className="underline">Read in full</Link> · {citation(e)}
        </p>
      </div>

      {note && (
        <p role="status" className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 mx-auto w-fit rounded-full bg-accent px-4 py-2 text-small font-semibold text-accent-ink shadow-[0_8px_24px_-8px_rgb(0_0_0/0.4)]">
          {note}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 short:pb-2 short:pt-1" style={{ background: "linear-gradient(180deg, transparent, var(--sky-bottom) 40%)" }}>
        <div className="mx-auto grid max-w-2xl grid-cols-[1fr_1.7fr_1fr] gap-3">
          <button onClick={() => go(-1)} disabled={i === 0} aria-label={verse ? "Previous verse" : "Previous card"} className="grid min-h-14 short:min-h-11 place-items-center glass-chip rounded-full border border-line text-card-ink disabled:opacity-40">
            <Chevron className="rotate-180" size={24} />
          </button>
          <button onClick={finish} className="btn btn-primary px-0 short:!min-h-11">I&apos;m Done</button>
          <button onClick={() => go(1)} disabled={i === steps.length - 1} aria-label={verse ? "Next verse" : "Next card"} className="grid min-h-14 short:min-h-11 place-items-center rounded-full bg-ink text-[var(--sky-bottom)] disabled:opacity-40">
            <Chevron size={24} />
          </button>
        </div>
      </div>

      <Sheet open={panel === "list"} onOpenChange={(o) => setPanel(o ? "list" : null)} title={SETS[set]} description="Tap a card to go to it.">
        <ul className="grid gap-2 pt-1">
          {entries.map((x, k) => (
            <li key={x.id}>
              <button
                onClick={() => { setDir(k >= cur.entryIndex ? 1 : -1); setPos({ id: x.id, vi: 0 }); setPanel(null); }}
                aria-current={k === cur.entryIndex ? "true" : undefined}
                className={`flex min-h-14 w-full items-center gap-3 rounded-[20px] border px-4 text-left ${k === cur.entryIndex ? "border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_14%,transparent)]" : "border-line"}`}
              >
                <span className="tabular w-6 text-card-soft">{k + 1}</span>
                <span className="display flex-1 text-[1.15rem] leading-tight">{x.title}</span>
                {!open(x) && <span className="grid size-7 place-items-center rounded-full bg-accent text-accent-ink"><Check size={16} /></span>}
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
