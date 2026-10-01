"use client";
import Fuse from "fuse.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { chapters, juz, juzSpan, chapter, loadSurah, readHref, surahUrl, type Chapter, type Verse } from "@/lib/quran";
import { toggleMark, useOffline, useQuran } from "@/lib/quran-store";
import { Bookmark, Chevron, CloudCheck, CloudDown, Search } from "./Glyphs";
import { VerseSheet } from "./VerseSheet";

type Tab = "chapter" | "juz" | "bookmarks";

/** Chapter and Juz tabs with search. Used on the Quran page and inside the surah picker sheet. */
export function ChapterList({ onPick }: { onPick?: () => void }) {
  const q = useQuran();
  const off = useOffline();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("chapter");
  const [pick, setPick] = useState<Chapter | null>(null);
  const marks = useMemo(() => new Set(q.marks), [q.marks]);
  const seen = useMemo(() => new Set(q.seen.keys), [q.seen.keys]);
  const [term, setTerm] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const fuse = useMemo(
    () => new Fuse(chapters, { threshold: 0.32, ignoreLocation: true, keys: ["name", "meaning", "arabic", { name: "idText", getFn: (c: Chapter) => String(c.id) }] }),
    [],
  );
  const term1 = term.trim();
  const found = term1 ? fuse.search(term1).map((r) => r.item) : null;

  const toggleSave = async (c: Chapter) => {
    setBusy(c.id);
    if (off.offline.has(c.id)) await off.remove(c.id, surahUrl);
    else await off.save([c.id], surahUrl);
    setBusy(null);
  };

  const row = (c: Chapter) => {
    const here = q.last?.surah === c.id;
    const saved = off.offline.has(c.id);
    return (
      <li key={c.id} className={`flex items-stretch rounded-[20px] border ${here ? "border-[var(--accent)] bg-[color-mix(in_oklch,var(--accent)_14%,transparent)]" : "border-line"}`}>
        <button
          onClick={() => setPick(c)}
          aria-label={`${c.name}, ${c.verses} verses. Choose where to start`}
          className="flex min-h-[4.5rem] flex-1 items-center gap-3 px-4 py-3 text-left"
        >
          <span className="grid flex-1">
            <span className="display text-title leading-tight"><span className="tabular">{c.id}.</span> {c.name}</span>
            <span className="text-meta text-ink-soft">{c.meaning}{here && q.last!.verse > 1 ? ` · you were at verse ${q.last!.verse}` : ""}</span>
          </span>
          <span className="text-meta text-ink-soft tabular">{c.verses} verses</span>
        </button>
        <button
          onClick={() => toggleSave(c)}
          disabled={busy === c.id}
          aria-label={saved ? `${c.name} is saved for offline. Remove the saved copy` : `Save ${c.name} for offline reading`}
          className={`grid min-w-14 place-items-center rounded-r-[20px] ${saved ? "text-accent" : "text-ink-soft"} ${busy === c.id ? "animate-pulse" : ""}`}
        >
          {saved ? <CloudCheck size={26} /> : <CloudDown size={26} />}
        </button>
      </li>
    );
  };

  return (
    <div>
      <VerseSheet
        open={pick !== null}
        onOpenChange={(o) => !o && setPick(null)}
        surah={pick?.id ?? 1}
        count={pick?.verses ?? 7}
        current={pick && q.last?.surah === pick.id ? q.last.verse : 0}
        resume={pick && q.last?.surah === pick.id && q.last.verse > 1 ? q.last.verse : undefined}
        seen={seen}
        marks={marks}
        onPick={(n) => { const id = pick!.id; setPick(null); onPick?.(); router.push(readHref(id, n)); }}
      />
      <div className="flex rounded-full border border-line p-1" role="tablist" aria-label="Browse by">
        {(["juz", "chapter", "bookmarks"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 flex-1 rounded-full text-base font-semibold transition-colors ${tab === t ? "bg-accent text-accent-ink" : ""}`}
          >
            {t === "juz" ? "Juz" : t === "chapter" ? "Chapter" : `Bookmarks${q.marks.length ? ` (${q.marks.length})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "bookmarks" ? <Bookmarks onPick={onPick} /> : (
      <>
      <label className="relative mt-3 block">
        <span className="sr-only">Search surahs</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search a surah"
          autoComplete="off"
          className="field pl-11 placeholder:text-ink-soft"
        />
      </label>

      {found ? (
        found.length ? <ul className="mt-4 grid gap-2.5">{found.map(row)}</ul> : <p className="mt-6 text-center text-ink-soft">No surah matches that.</p>
      ) : tab === "chapter" ? (
        <ul className="mt-4 grid gap-2.5">{chapters.map(row)}</ul>
      ) : (
        <ul className="mt-4 grid gap-2.5">
          {juz.map((j) => (
            <li key={j.n} className="rounded-[20px] border border-line">
              <details className="group">
                <summary className="flex min-h-[4.5rem] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="grid flex-1">
                    <span className="display text-title leading-tight">Juz {j.n}</span>
                    <span className="text-meta text-ink-soft">{juzSpan(j)}</span>
                  </span>
                  <Chevron className="shrink-0 text-ink-soft transition-transform duration-300 group-open:rotate-90" />
                </summary>
                <ul className="grid gap-1 px-2 pb-3">
                  {j.ranges.map((r) => (
                    <li key={r.surah}>
                      <Link href={readHref(r.surah, r.from)} onClick={onPick} className="flex min-h-11 items-center justify-between rounded-full px-3 no-underline hover:bg-[color-mix(in_oklch,var(--ink)_8%,transparent)]">
                        <span>{chapter(r.surah).name}</span>
                        <span className="text-meta text-ink-soft tabular">verses {r.from}{r.to > r.from ? `–${r.to}` : ""}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
      </>
      )}
    </div>
  );
}


/** Saved verses, newest first. The text is read from this device's own copy of each surah. */
function Bookmarks({ onPick }: { onPick?: () => void }) {
  const q = useQuran();
  const [text, setText] = useState<Record<number, Verse[]>>({});
  const items = useMemo(
    () => [...q.marks].reverse().map((k) => { const [s, v] = k.split(":").map(Number); return { key: k, s, v }; }).filter((x) => x.s >= 1 && x.s <= 114),
    [q.marks],
  );
  const wanted = useMemo(() => [...new Set(items.map((i) => i.s))].sort().join(","), [items]);

  useEffect(() => {
    let live = true;
    wanted.split(",").filter(Boolean).map(Number).forEach((n) => {
      loadSurah(n).then((v) => live && setText((t) => (t[n] ? t : { ...t, [n]: v }))).catch(() => {});
    });
    return () => { live = false; };
  }, [wanted]);

  if (!items.length)
    return (
      <div className="mt-6 rounded-[28px] border border-line p-6 text-center">
        <Bookmark size={28} className="mx-auto text-ink-soft" />
        <p className="display mt-2 text-title">No bookmarks yet</p>
        <p className="mt-1 text-ink-soft">Tap the bookmark at the top of a verse to keep it here. Bookmarks stay on this device.</p>
      </div>
    );

  return (
    <ul className="mt-4 grid gap-2.5">
      {items.map(({ key, s, v }) => {
        const verse = text[s]?.[v - 1];
        return (
          <li key={key} className="flex items-stretch rounded-[20px] border border-line">
            <Link href={readHref(s, v)} onClick={onPick} className="grid min-h-[4.5rem] flex-1 gap-1 px-4 py-3 no-underline">
              <span className="display text-title leading-tight">{chapter(s).name} <span className="tabular text-ink-soft">{s}:{v}</span></span>
              {verse ? (
                <>
                  <span lang="ar" dir="rtl" className="truncate text-right font-[family-name:var(--font-arabic)] text-[1.3rem] leading-[1.8]">{verse.ar.trim()}</span>
                  <span className="line-clamp-2 text-meta text-ink-soft">{verse.en}</span>
                </>
              ) : (
                <span className="text-meta text-ink-soft">Loading…</span>
              )}
            </Link>
            <button
              onClick={() => toggleMark(s, v)}
              aria-label={`Remove bookmark from ${chapter(s).name} ${s}:${v}`}
              className="grid min-w-14 place-items-center rounded-r-[20px] text-accent"
            >
              <Bookmark size={24} filled />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
