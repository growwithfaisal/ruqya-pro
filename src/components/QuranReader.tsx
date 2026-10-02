"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { TAJWEED, bismillah, chapter, juzOf, loadSurah, readHref, safeSurah, safeVerse, surahUrl, type Verse } from "@/lib/quran";
import { markSeen, seenCount, setLast, setPrefs, toggleMark, useOffline, useQuran } from "@/lib/quran-store";
import { isFriday } from "@/lib/sky";
import { ArabicSizeControl } from "./ArabicSizeControl";
import { ChapterList } from "./ChapterList";
import { Bookmark, Chevron, CloudCheck, CloudDown, Search } from "./Glyphs";
import { Coloured } from "./Coloured";
import { Translit } from "./Translit";
import { Sheet } from "./Sheet";
import { TranslitGuideRow } from "./TranslitGuide";
import { VerseSheet } from "./VerseSheet";

type Panel = null | "surah" | "verse" | "settings";
const SWIPE = 80;

/** One verse at a time. The plain Arabic is always what is shown; tajweed colours are painted over its letters. */
export function QuranReader() {
  const params = useSearchParams();
  const router = useRouter();
  const reduce = useReducedMotion();
  const surah = safeSurah(params.get("s"));
  const c = chapter(surah);
  const q = useQuran();

  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [n, setN] = useState(() => safeVerse(surah, params.get("v")));
  const [dir, setDir] = useState(1);
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState("");
  const dragged = useRef(false);

  // Load the surah (from this device's saved copy when there is one) and start at the requested verse.
  useEffect(() => {
    let live = true;
    setVerses(null);
    setFailed(false);
    setN(safeVerse(surah, params.get("v")));
    loadSurah(surah).then((v) => live && setVerses(v)).catch(() => live && setFailed(true));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surah, attempt]);

  // Keep the address, the saved place and today's count in step with the verse on screen.
  useEffect(() => {
    if (!verses) return;
    const u = new URL(location.href);
    u.searchParams.set("s", String(surah));
    if (n > 1) u.searchParams.set("v", String(n)); else u.searchParams.delete("v");
    history.replaceState(history.state, "", u);

    setLast(surah, n);
  }, [verses, surah, n]);

  const flash = useCallback((text: string) => {
    setNote(text);
    window.setTimeout(() => setNote((t) => (t === text ? "" : t)), 3000);
  }, []);

  /**
   * A verse is read the moment the reader moves on from it, or taps I'm Done on it: there is no waiting. Returns the line to
   * flash when this verse completed Al-Kahf on a Friday or tipped today over the goal.
   */
  const markRead = (s: number, v: number) => {
    const kahf = chapter(18).verses;
    const before = seenCount(18);
    const tipped = markSeen(s, v);
    if (s === 18 && isFriday() && before < kahf && seenCount(18) >= kahf) return "Friday recitation complete";
    return tipped ? "Today counted" : "";
  };

  const go = useCallback(
    (d: 1 | -1) => {
      if (d === 1) {
        const msg = markRead(surah, n);
        if (msg) flash(msg);
      }
      const next = n + d;
      setDir(d);
      if (next >= 1 && next <= c.verses) setN(next);
      else if (d > 0 && surah < 114) router.push(readHref(surah + 1));
      else if (d < 0 && surah > 1) router.push(readHref(surah - 1, chapter(surah - 1).verses));
    },
    [n, c.verses, surah, router, flash],
  );

  const jump = useCallback((to: number) => {
    setPanel(null);
    setDir(to >= n ? 1 : -1);
    setN(to);
  }, [n]);

  const done = () => {
    markRead(surah, n);
    setLast(surah, n);
    router.push("/quran");
  };

  const share = async () => {
    const url = `${location.origin}${readHref(surah, n)}`;
    const title = `${c.name} ${surah}:${n}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); flash("Link copied"); }
    } catch {}
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel || (e.target instanceof HTMLElement && e.target.closest("input, textarea"))) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, panel]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setTimeout(() => (dragged.current = false), 0);
    if (info.offset.x < -SWIPE || info.velocity.x < -500) go(1);
    else if (info.offset.x > SWIPE || info.velocity.x > 500) go(-1);
  };

  const marks = useMemo(() => new Set(q.marks), [q.marks]);
  const seen = useMemo(() => new Set(q.seen.keys), [q.seen.keys]);
  const v = verses?.[n - 1];
  const marked = marks.has(`${surah}:${n}`);
  const left = c.verses - n;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 340, damping: 32, mass: 0.9 };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4.5rem)] max-w-2xl flex-col px-4 pb-4 pt-5 short:grid short:min-h-0 short:max-w-none short:grid-cols-2 short:content-start short:gap-x-5 short:pb-20 short:pt-2 md:px-8 md:pt-8">
      {failed && (
        <div className="mt-12 rounded-[28px] border border-line p-6 text-center short:col-span-2 short:mt-4" role="alert">
          <p className="display text-title">This surah is not on this device yet.</p>
          <p className="mt-2 text-ink-soft">You seem to be offline. Connect once and open it, or save it from the Qur&apos;an page for later.</p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={() => setAttempt((a) => a + 1)} className="btn btn-sm btn-primary">Try again</button>
            <Link href="/quran" className="btn btn-sm btn-secondary">All surahs</Link>
          </div>
        </div>
      )}

      {!verses && !failed && (
        <div role="status" aria-label={`Opening ${c.name}`} className="short:col-span-2">
          <p className="text-center text-small text-ink-soft">Opening {c.name}</p>
          <div className="skeleton mt-3 h-[min(26rem,52dvh)]" aria-hidden />
          <div className="mt-6 grid gap-3" aria-hidden>
            <div className="skeleton mx-auto h-5 w-4/5 !rounded-full" />
            <div className="skeleton mx-auto h-5 w-3/5 !rounded-full" />
          </div>
        </div>
      )}

      {verses && v && (
        <>
          <p className="text-center text-small text-ink-soft tabular short:hidden" aria-live="polite">
            Juz {juzOf(surah, n)} · {left === 0 ? "last verse" : `${left} ${left === 1 ? "verse" : "verses"} left`}
          </p>

          <div className="relative mt-3 short:mt-0">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.section
                key={`${surah}:${n}`}
                custom={dir}
                aria-label={`${c.name} verse ${n} of ${c.verses}`}
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
                  <button onClick={() => setPanel("surah")} aria-label="Choose a surah" className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h10" /></svg>
                  </button>
                  <button onClick={() => setPanel("verse")} aria-label={`Verse ${n} of ${c.verses}. Choose a verse`} className="min-h-12 rounded-[20px] text-center">
                    <span className="display block text-title leading-tight"><span className="tabular">{c.id}.</span> {c.name}</span>
                    <span className="block text-small text-card-soft tabular">{n}/{c.verses}</span>
                  </button>
                  <button
                    onClick={() => toggleMark(surah, n)}
                    aria-pressed={marked}
                    aria-label={marked ? `Remove bookmark from verse ${n}` : `Bookmark verse ${n}`}
                    className={`grid min-h-11 min-w-11 place-items-center rounded-full ${marked ? "text-accent" : "text-card-soft"}`}
                  >
                    <Bookmark size={24} filled={marked} />
                  </button>
                </header>

                <div className="max-h-[46dvh] overflow-y-auto px-5 py-5 short:max-h-[calc(100dvh-11.5rem)] short:py-2">
                  {n === 1 && c.bismillahPre && <p lang="ar" dir="rtl" className="arabic mb-2 border-b border-line pb-3 !text-[1.6rem] text-card-soft">{bismillah}</p>}
                  <p lang="ar" dir="rtl" className="arabic arabic-read !text-center">
                    {q.prefs.tajweed && v.tg ? <Coloured ar={v.ar.trim()} ranges={v.tg} lead={v.ar.length - v.ar.trimStart().length} /> : v.ar.trim()}
                  </p>
                </div>

                <footer className="flex items-center justify-between px-3 pb-3">
                  <button onClick={share} aria-label={`Share verse ${n}`} className="grid min-h-11 min-w-11 place-items-center rounded-full bg-accent text-accent-ink">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 5l6 6-6 6M20 11H9a5 5 0 0 0-5 5v2" /></svg>
                  </button>
                  <span className="text-meta text-card-soft">{seen.has(`${surah}:${n}`) ? "Read today" : ""}</span>
                  <button onClick={() => setPanel("settings")} aria-label="Reading settings" className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line text-lead">Aa</button>
                </footer>
              </motion.section>
            </AnimatePresence>
          </div>

          <div className="mt-6 text-center short:mt-0 short:max-h-[calc(100dvh-5.5rem)] short:overflow-y-auto">
            {q.prefs.translit && <p className="text-[calc(clamp(1.25rem,4.6vw,1.55rem)*var(--translit-scale))] leading-snug"><Translit text={v.tr} marks={v.tu} silent={v.ts} /></p>}
            {q.prefs.translation && <p className={`mx-auto max-w-[60ch] leading-relaxed text-ink-soft ${q.prefs.translit ? "mt-4 text-base" : "text-[1.2rem] text-ink"}`}>{v.en}</p>}
          </div>
        </>
      )}

      {note && (
        <p role="status" className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 mx-auto w-fit rounded-full bg-accent px-4 py-2 text-small font-semibold text-accent-ink shadow-[0_8px_24px_-8px_rgb(0_0_0/0.4)]">
          {note}
        </p>
      )}

      {/* Actions stay under the thumb and above the home indicator. */}
      {verses && (
        <div className="sticky bottom-0 z-20 mt-auto -mx-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 short:fixed short:inset-x-0 short:mx-0 short:pb-2 short:pt-1 md:-mx-8 md:px-8" style={{ background: "linear-gradient(180deg, transparent, var(--sky-bottom) 40%)" }}>
          <div className="mx-auto grid max-w-2xl grid-cols-[1fr_1.7fr_1fr] gap-3">
            <button onClick={() => go(-1)} disabled={n === 1 && surah === 1} aria-label="Previous verse" className="grid min-h-14 short:min-h-11 place-items-center glass-chip rounded-full border border-line text-card-ink disabled:opacity-40">
              <Chevron className="rotate-180" size={24} />
            </button>
            <button onClick={done} className="btn btn-primary px-0 short:!min-h-11">I&apos;m Done</button>
            <button onClick={() => go(1)} disabled={n === c.verses && surah === 114} aria-label="Next verse" className="grid min-h-14 short:min-h-11 place-items-center rounded-full bg-ink text-[var(--sky-bottom)] disabled:opacity-40">
              <Chevron size={24} />
            </button>
          </div>
        </div>
      )}

      <Sheet open={panel === "surah"} onOpenChange={(o) => setPanel(o ? "surah" : null)} title="Choose a surah">
        <div className="pt-1"><ChapterList onPick={() => setPanel(null)} /></div>
      </Sheet>
      <VerseSheet open={panel === "verse"} onOpenChange={(o) => setPanel(o ? "verse" : null)} surah={surah} count={c.verses} current={n} seen={seen} marks={marks} onPick={jump} />
      <SettingsSheet open={panel === "settings"} onOpenChange={(o) => setPanel(o ? "settings" : null)} surah={surah} />
    </div>
  );
}

function SettingsSheet({ open, onOpenChange, surah }: { open: boolean; onOpenChange: (o: boolean) => void; surah: number }) {
  const q = useQuran();
  const off = useOffline();
  const [busy, setBusy] = useState(false);
  const saved = off.offline.has(surah);
  const Row = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
    <label className="flex min-h-14 items-center justify-between border-b border-line">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} className="size-6 accent-[var(--accent)]" />
    </label>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Reading" description="Saved on this device only.">
      <Row label="Transliteration" on={q.prefs.translit} set={(v) => setPrefs({ translit: v })} />
      <Row label="Translation (Saheeh International)" on={q.prefs.translation} set={(v) => setPrefs({ translation: v })} />
      <Row label="Tajweed colours" on={q.prefs.tajweed} set={(v) => setPrefs({ tajweed: v })} />
      <div className="flex min-h-16 items-center justify-between border-b border-line">
        <span>Arabic size</span>
        <ArabicSizeControl />
      </div>
      <TranslitGuideRow />
      <button
        disabled={busy}
        onClick={async () => { setBusy(true); if (saved) await off.remove(surah, surahUrl); else await off.save([surah], surahUrl); setBusy(false); }}
        className="btn btn-sm btn-secondary mt-5 w-full font-semibold"
      >
        {saved ? <CloudCheck /> : <CloudDown />} {saved ? "Saved offline. Remove" : "Save this surah for offline"}
      </button>

      {q.prefs.tajweed && (
        <section className="mt-7" aria-labelledby="tj-legend">
          <h3 id="tj-legend" className="text-small font-semibold">Colours</h3>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-meta">
            {TAJWEED.map(([cls, label]) => (
              <li key={cls} className="flex items-center gap-2">
                <span className={`tj-${cls} arabic !text-[1.3rem] !leading-none`} aria-hidden>ـــ</span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-meta text-card-soft">Colours come from Quran.com&apos;s tajweed marking. A few verses show without colour where it could not be matched to the text exactly.</p>
        </section>
      )}
    </Sheet>
  );
}
