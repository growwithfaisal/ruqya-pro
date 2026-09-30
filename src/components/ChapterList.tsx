"use client";
import Fuse from "fuse.js";
import Link from "next/link";
import { useMemo, useState } from "react";
import { chapters, juz, juzSpan, chapter, readHref, surahUrl, type Chapter } from "@/lib/quran";
import { useOffline, useQuran } from "@/lib/quran-store";
import { Chevron, CloudCheck, CloudDown, Search } from "./Glyphs";

type Tab = "chapter" | "juz";

/** Chapter and Juz tabs with search. Used on the Quran page and inside the surah picker sheet. */
export function ChapterList({ onPick }: { onPick?: () => void }) {
  const q = useQuran();
  const off = useOffline();
  const [tab, setTab] = useState<Tab>("chapter");
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
        <Link href={readHref(c.id, here ? q.last!.verse : 1)} onClick={onPick} className="flex min-h-[4.5rem] flex-1 items-center gap-3 px-4 py-3 no-underline">
          <span className="grid flex-1">
            <span className="display text-[1.25rem] leading-tight"><span className="tabular">{c.id}.</span> {c.name}</span>
            <span className="text-[0.92rem] text-ink-soft">{c.meaning}{here && q.last!.verse > 1 ? ` · resume at verse ${q.last!.verse}` : ""}</span>
          </span>
          <span className="text-[0.92rem] text-ink-soft tabular">{c.verses} verses</span>
        </Link>
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
      <div className="flex rounded-full border border-line p-1" role="tablist" aria-label="Browse by">
        {(["juz", "chapter"] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 flex-1 rounded-full text-[1rem] font-semibold transition-colors ${tab === t ? "bg-accent text-accent-ink" : ""}`}
          >
            {t === "juz" ? "Juz" : "Chapter"}
          </button>
        ))}
      </div>

      <label className="relative mt-3 block">
        <span className="sr-only">Search surahs</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search a surah"
          autoComplete="off"
          className="min-h-12 w-full rounded-full border border-line bg-transparent pl-11 pr-4 text-[1rem] placeholder:text-ink-soft"
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
                    <span className="display text-[1.25rem] leading-tight">Juz {j.n}</span>
                    <span className="text-[0.92rem] text-ink-soft">{juzSpan(j)}</span>
                  </span>
                  <Chevron className="shrink-0 text-ink-soft transition-transform duration-300 group-open:rotate-90" />
                </summary>
                <ul className="grid gap-1 px-2 pb-3">
                  {j.ranges.map((r) => (
                    <li key={r.surah}>
                      <Link href={readHref(r.surah, r.from)} onClick={onPick} className="flex min-h-11 items-center justify-between rounded-full px-3 no-underline hover:bg-[color-mix(in_oklch,var(--ink)_8%,transparent)]">
                        <span>{chapter(r.surah).name}</span>
                        <span className="text-[0.92rem] text-ink-soft tabular">verses {r.from}{r.to > r.from ? `–${r.to}` : ""}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
