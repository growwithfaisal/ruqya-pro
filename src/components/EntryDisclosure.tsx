import Link from "next/link";
import type { Entry } from "@/lib/types";
import { UNSOURCED_NOTE, citation, surahName } from "@/lib/entries";
import { Translit } from "./Translit";
import { CitationBadge } from "./CitationBadge";
import { Chevron } from "./Glyphs";

/** One recitation as an expandable row: closed it is a title and a reference, open it is the full text. */
export function EntryDisclosure({ entry }: { entry: Entry }) {
  return (
    <details id={entry.slug} className="group border-b border-line">
      <summary className="press-row -mx-3 flex min-h-[4rem] cursor-pointer list-none items-center gap-3 rounded-2xl px-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="grid flex-1">
          <span className="display text-title leading-tight">{entry.title}</span>
          <span className="text-meta text-ink-soft">{[surahName(entry), citation(entry), entry.repeat].filter(Boolean).join(" · ")}</span>
        </span>
        <Chevron className="shrink-0 text-ink-soft transition-transform duration-300 group-open:rotate-90" />
      </summary>
      <div className="pb-7">
        {entry.arabic.trim() && (
          <div className="glass rounded-[28px] border border-line px-5 py-6 text-card-ink">
            {entry.arabic.split("\n").map((l, i) => (
              <p key={i} lang="ar" dir="rtl" className="arabic">{l.trim()}</p>
            ))}
          </div>
        )}
        {entry.unsourced && <p className="mt-4 text-small">{UNSOURCED_NOTE}</p>}
        {entry.transliteration && (
          <div className="mt-4 max-w-[65ch] text-[calc(1rem*var(--translit-scale))] italic leading-relaxed text-ink-soft">
            {entry.transliteration.split("\n").map((l, i, all) => <p key={i}>{all.length === 1 ? <Translit text={l} marks={entry.tu} silent={entry.ts} /> : l}</p>)}
          </div>
        )}
        {entry.translation && (
          <div className="mt-4 max-w-[65ch] leading-relaxed">
            {entry.translation.split("\n").map((l, i) => <p key={i}>{l}</p>)}
          </div>
        )}
        {entry.practice && <p className="mt-3 max-w-[65ch] text-small text-ink-soft">{entry.practice}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CitationBadge entry={entry} tone="sky" />
          <Link href={`/recitations/${entry.slug}`} className="min-h-11 content-center text-small underline">Read in full</Link>
        </div>
      </div>
    </details>
  );
}
