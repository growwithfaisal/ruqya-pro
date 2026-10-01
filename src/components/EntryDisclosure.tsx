import Link from "next/link";
import type { Entry } from "@/lib/types";
import { Translit } from "./Translit";
import { CitationBadge } from "./CitationBadge";
import { Chevron } from "./Glyphs";

/** One recitation as an expandable row: closed it is a title and a reference, open it is the full text. */
export function EntryDisclosure({ entry }: { entry: Entry }) {
  return (
    <details id={entry.slug} className="group border-b border-line">
      <summary className="flex min-h-[4rem] cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="grid flex-1">
          <span className="display text-[1.3rem] leading-tight">{entry.title}</span>
          <span className="text-[0.92rem] text-ink-soft">{entry.source.book === "The Qur'an" ? `Qur'an ${entry.source.ref}` : `${entry.source.book} ${entry.source.ref}`}</span>
        </span>
        <Chevron className="shrink-0 text-ink-soft transition-transform duration-300 group-open:rotate-90" />
      </summary>
      <div className="pb-7">
        <div className="rounded-[28px] border border-line bg-card px-5 py-6 text-card-ink">
          {entry.arabic.split("\n").map((l, i) => (
            <p key={i} lang="ar" dir="rtl" className="arabic">{l.trim()}</p>
          ))}
        </div>
        {entry.transliteration && (
          <div className="mt-4 max-w-[65ch] italic leading-relaxed text-ink-soft">
            {entry.transliteration.split("\n").map((l, i, all) => <p key={i}>{all.length === 1 ? <Translit text={l} marks={entry.tu} silent={entry.ts} /> : l}</p>)}
          </div>
        )}
        <div className="mt-4 max-w-[65ch] leading-relaxed">
          {entry.translation.split("\n").map((l, i) => <p key={i}>{l}</p>)}
        </div>
        {entry.repeat && <p className="mt-3 text-ink-soft">{entry.repeat}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CitationBadge entry={entry} tone="sky" />
          <Link href={`/recitations/${entry.slug}`} className="min-h-11 content-center text-[0.95rem] underline">Read in full</Link>
        </div>
      </div>
    </details>
  );
}
