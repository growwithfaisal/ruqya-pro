"use client";
import { useMemo, useState } from "react";
import { chapter } from "@/lib/quran";
import { Bookmark, Search } from "./Glyphs";
import { Sheet } from "./Sheet";

/** Pick a verse number in a surah. Used by the reader and by the surah list ("start from verse..."). */
export function VerseSheet({
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
        <input inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value.replace(/\D/g, ""))} placeholder="Verse number" className="field pl-11 placeholder:text-card-soft" />
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
                className={`relative grid aspect-square w-full place-items-center rounded-[20px] text-lead font-semibold tabular ${n === current ? "bg-accent text-accent-ink" : "border border-line"}`}
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
