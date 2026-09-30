"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bismillah, chapter, loadSurah, readHref, safeSurah, safeVerse, surahUrl, type Verse } from "@/lib/quran";
import { markSeen, setLast, setPrefs, toggleMark, useOffline, useQuran } from "@/lib/quran-store";
import { ArabicSizeControl } from "./ArabicSizeControl";
import { ChapterList } from "./ChapterList";
import { Bookmark, CloudCheck, CloudDown, Search } from "./Glyphs";
import { Sheet } from "./Sheet";

type Panel = null | "surah" | "verse" | "settings";

export function QuranReader() {
  const params = useSearchParams();
  const surah = safeSurah(params.get("s"));
  const start = useRef(safeVerse(surah, params.get("v")));
  const c = chapter(surah);
  const q = useQuran();

  const [verses, setVerses] = useState<Verse[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(start.current);
  const [panel, setPanel] = useState<Panel>(null);
  const [counted, setCounted] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Load the surah (from this device's saved copy when there is one).
  useEffect(() => {
    let live = true;
    setVerses(null);
    setFailed(false);
    loadSurah(surah).then((v) => live && setVerses(v)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [surah, attempt]);

  // Land on the requested verse once the text is there.
  useEffect(() => {
    if (!verses) return;
    start.current = safeVerse(surah, params.get("v"));
    setCurrent(start.current);
    requestAnimationFrame(() => {
      if (start.current > 1) document.getElementById(`v-${start.current}`)?.scrollIntoView({ block: "start" });
      else window.scrollTo({ top: 0 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verses]);

  // Track what is on screen: the top verse becomes "where you are", and 10 verses read in a day counts the day.
  useEffect(() => {
    if (!verses) return;
    const visible = new Set<number>();
    const timers = new Map<number, number>();
    let saveTimer = 0;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.n);
          const tall = e.rootBounds ? e.intersectionRect.height >= e.rootBounds.height * 0.5 : false;
          const on = e.isIntersecting && (e.intersectionRatio >= 0.6 || tall);
          if (on) {
            visible.add(n);
            if (!timers.has(n)) {
              timers.set(n, window.setTimeout(() => {
                if (document.visibilityState === "visible" && markSeen(surah, n)) {
                  setCounted(true);
                  window.setTimeout(() => setCounted(false), 3500);
                }
              }, 1000));
            }
          } else {
            visible.delete(n);
            const t = timers.get(n);
            if (t) { clearTimeout(t); timers.delete(n); }
          }
        }
        if (visible.size) {
          const top = Math.min(...visible);
          setCurrent(top);
          clearTimeout(saveTimer);
          saveTimer = window.setTimeout(() => setLast(surah, top), 700);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    document.querySelectorAll<HTMLElement>("[data-n]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
      clearTimeout(saveTimer);
    };
  }, [verses, surah]);

  const jump = useCallback((n: number) => {
    setPanel(null);
    setCurrent(n);
    // Wait for the sheet to release focus and scroll lock before moving the page.
    setTimeout(() => document.getElementById(`v-${n}`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 120);
  }, []);

  const marks = useMemo(() => new Set(q.marks), [q.marks]);
  const seen = useMemo(() => new Set(q.seen.keys), [q.seen.keys]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-8 md:px-8 md:pt-12">
      <header className="text-center">
        <p className="text-[0.95rem] text-ink-soft tabular">Surah {c.id} · {c.verses} verses · {c.place === "madinah" ? "Madinan" : "Makkan"}</p>
        <h1 className="display mt-1 text-[clamp(2rem,7vw,3rem)] leading-tight">{c.name}</h1>
        <p className="text-ink-soft">{c.meaning}</p>
        <p lang="ar" dir="rtl" className="arabic mt-1 !text-[2.2rem]">{c.arabic}</p>
      </header>

      <div className="mt-5 flex justify-center gap-2" role="group" aria-label="Show under each verse">
        {([["translit", "Transliteration"], ["translation", "Translation"]] as const).map(([k, label]) => (
          <button
            key={k}
            aria-pressed={q.prefs[k]}
            onClick={() => setPrefs({ [k]: !q.prefs[k] })}
            className={`min-h-11 rounded-full border px-4 text-[0.95rem] transition-colors ${q.prefs[k] ? "border-transparent bg-ink text-[var(--sky-bottom)]" : "border-line"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!verses && !failed && <p className="mt-16 text-center text-ink-soft" role="status">Opening {c.name}…</p>}

      {failed && (
        <div className="mt-12 rounded-[28px] border border-line p-6 text-center" role="alert">
          <p className="display text-[1.4rem]">This surah is not on this device yet.</p>
          <p className="mt-2 text-ink-soft">You seem to be offline. Connect once and open it, or save it from the Qur&apos;an page for later.</p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={() => setAttempt((a) => a + 1)} className="min-h-12 rounded-full bg-accent px-5 font-semibold text-accent-ink">Try again</button>
            <Link href="/quran" className="grid min-h-12 place-items-center rounded-full border border-line px-5 no-underline">All surahs</Link>
          </div>
        </div>
      )}

      {verses && (
        <>
          {c.bismillahPre && <p lang="ar" dir="rtl" className="arabic mt-8 border-b border-line pb-6 !text-[2rem]">{bismillah}</p>}
          <div className={c.bismillahPre ? "" : "mt-8 border-t border-line"}>
            {verses.map((v) => (
              <article key={v.n} id={`v-${v.n}`} data-n={v.n} className="scroll-mt-24 border-b border-line py-7">
                <div className="mb-3 flex items-center justify-between">
                  <button
                    onClick={() => toggleMark(surah, v.n)}
                    aria-pressed={marks.has(`${surah}:${v.n}`)}
                    aria-label={`${marks.has(`${surah}:${v.n}`) ? "Remove bookmark from" : "Bookmark"} verse ${v.n}`}
                    className={`flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[0.95rem] tabular ${marks.has(`${surah}:${v.n}`) ? "border-[var(--accent)] text-accent" : "border-line text-ink-soft"}`}
                  >
                    <Bookmark filled={marks.has(`${surah}:${v.n}`)} /> {surah}:{v.n}
                  </button>
                  {seen.has(`${surah}:${v.n}`) && <span className="text-[0.85rem] text-ink-soft">Read today</span>}
                </div>
                <p lang="ar" dir="rtl" className="arabic arabic-read">{v.ar.trim()}</p>
                {q.prefs.translit && <p className="mt-3 text-[1rem] italic leading-relaxed text-ink-soft">{v.tr}</p>}
                {q.prefs.translation && <p className="mt-3 max-w-[65ch] text-[1.05rem] leading-relaxed">{v.en}</p>}
              </article>
            ))}
          </div>

          <nav aria-label="Next" className="mt-10 grid gap-3 text-center">
            {c.id < 114 ? (
              <Link href={readHref(c.id + 1)} className="grid min-h-16 place-items-center rounded-[28px] bg-accent px-5 font-semibold text-accent-ink no-underline">
                Next: {chapter(c.id + 1).name}
              </Link>
            ) : (
              <Link href="/quran" className="grid min-h-16 place-items-center rounded-[28px] bg-accent px-5 font-semibold text-accent-ink no-underline">You reached the end. All surahs</Link>
            )}
            {c.id > 1 && <Link href={readHref(c.id - 1)} className="min-h-11 content-center underline">Previous: {chapter(c.id - 1).name}</Link>}
          </nav>
          <p className="mt-10 text-center text-[0.85rem] text-ink-soft">
            Arabic: Quran.com (Uthmani). Translation: Saheeh International. Transliteration: Quran.com. <Link href="/sources" className="underline">Sources</Link>
          </p>
        </>
      )}

      {counted && (
        <p role="status" className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 mx-auto w-fit rounded-full bg-accent px-4 py-2 text-[0.95rem] font-semibold text-accent-ink shadow-[0_8px_24px_-8px_rgb(0_0_0/0.4)]">
          Today counted
        </p>
      )}

      {/* Reader dock: thumb reach on phones, safe-area aware in the home-screen app. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-card p-1.5 text-card-ink shadow-[0_12px_32px_-12px_rgb(0_0_0/0.45)]">
          <button onClick={() => setPanel("surah")} className="min-h-12 max-w-[9.5rem] truncate rounded-full px-4 font-semibold">{c.name}</button>
          <span aria-hidden className="h-6 w-px bg-[var(--line)]" />
          <button onClick={() => setPanel("verse")} className="min-h-12 rounded-full px-4 tabular" aria-label={`Verse ${current} of ${c.verses}. Choose a verse`}>
            Verse {current}<span className="text-card-soft">/{c.verses}</span>
          </button>
          <span aria-hidden className="h-6 w-px bg-[var(--line)]" />
          <button onClick={() => setPanel("settings")} className="min-h-12 rounded-full px-4 text-[1.05rem]" aria-label="Reading settings">Aa</button>
        </div>
      </div>

      <Sheet open={panel === "surah"} onOpenChange={(o) => setPanel(o ? "surah" : null)} title="Choose a surah">
        <div className="pt-1"><ChapterList onPick={() => setPanel(null)} /></div>
      </Sheet>
      <VerseSheet open={panel === "verse"} onOpenChange={(o) => setPanel(o ? "verse" : null)} surah={surah} count={c.verses} current={current} seen={seen} marks={marks} onPick={jump} />
      <SettingsSheet open={panel === "settings"} onOpenChange={(o) => setPanel(o ? "settings" : null)} surah={surah} />
    </div>
  );
}

function VerseSheet({
  open, onOpenChange, surah, count, current, seen, marks, onPick,
}: { open: boolean; onOpenChange: (o: boolean) => void; surah: number; count: number; current: number; seen: Set<string>; marks: Set<string>; onPick: (n: number) => void }) {
  const [term, setTerm] = useState("");
  const all = useMemo(() => Array.from({ length: count }, (_, i) => i + 1), [count]);
  const list = term.trim() ? all.filter((n) => String(n).includes(term.trim())) : all;
  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setTerm(""); }} title="Select verse" description={`${chapter(surah).name} has ${count} verses.`}>
      <label className="relative mt-1 block">
        <span className="sr-only">Search verse number</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-card-soft" />
        <input inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value.replace(/\D/g, ""))} placeholder="Verse number" className="min-h-12 w-full rounded-full border border-line bg-transparent pl-11 pr-4 text-[1rem] placeholder:text-card-soft" />
      </label>
      <ul className="mt-4 grid grid-cols-5 gap-2.5">
        {list.map((n) => {
          const key = `${surah}:${n}`;
          return (
            <li key={n}>
              <button
                onClick={() => onPick(n)}
                aria-current={n === current ? "true" : undefined}
                aria-label={`Verse ${n}${seen.has(key) ? ", read today" : ""}${marks.has(key) ? ", bookmarked" : ""}`}
                className={`relative grid aspect-square w-full place-items-center rounded-[18px] text-[1.05rem] font-semibold tabular ${n === current ? "bg-accent text-accent-ink" : "border border-line"}`}
              >
                {n}
                {seen.has(key) && n !== current && <span aria-hidden className="absolute bottom-1.5 size-1.5 rounded-full bg-accent" />}
                {marks.has(key) && <Bookmark size={12} filled className="absolute right-1.5 top-1.5" />}
              </button>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="mt-6 text-center text-card-soft">This surah has no verse {term}.</p>}
    </Sheet>
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
      <Row label="Translation (Saheeh International)" on={q.prefs.translation} set={(v) => setPrefs({ translation: v })} />
      <Row label="Transliteration" on={q.prefs.translit} set={(v) => setPrefs({ translit: v })} />
      <div className="flex min-h-16 items-center justify-between border-b border-line">
        <span>Arabic size</span>
        <ArabicSizeControl />
      </div>
      <button
        disabled={busy}
        onClick={async () => { setBusy(true); if (saved) await off.remove(surah, surahUrl); else await off.save([surah], surahUrl); setBusy(false); }}
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line font-semibold disabled:opacity-60"
      >
        {saved ? <CloudCheck /> : <CloudDown />} {saved ? "Saved offline. Remove" : "Save this surah for offline"}
      </button>
    </Sheet>
  );
}

