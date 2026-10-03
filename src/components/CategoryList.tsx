"use client";
import Link from "next/link";
import { INTENTS } from "@/lib/entries";
import { doneKey, useDone } from "@/lib/progress";
import type { Intent } from "@/lib/types";
import { Check, Chevron, INTENT_GLYPH } from "./Glyphs";

/**
 * The Recitations tab: one row per need. Each opens in the one-card reader like the daily adhkar, and keeps its own
 * progress for the day (a recitation ticked in one category is not ticked in another).
 */
export function CategoryList({ ids: byCategory }: { ids: Record<Intent, string[]> }) {
  const { done } = useDone();
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
      {INTENTS.map((it) => {
        const Glyph = INTENT_GLYPH[it.id];
        const ids = byCategory[it.id] ?? [];
        const got = ids.filter((id) => done.has(doneKey(it.id, id))).length;
        const complete = ids.length > 0 && got >= ids.length;
        return (
          <li key={it.id} className="cv-auto rounded-[20px] border border-line">
            <Link href={`/recitations?intent=${it.id}`} className="press-row group flex min-h-[5.25rem] items-center gap-4 rounded-[20px] px-4 py-3 no-underline">
              <Glyph className="shrink-0 text-accent" size={30} />
              <span className="grid min-w-0 flex-1 gap-0.5 [overflow-wrap:anywhere]">
                <span className="display text-title leading-tight">{it.label}</span>
                <span className="text-meta text-ink-soft">{it.blurb}</span>
                {complete ? (
                  <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-meta font-semibold text-accent-ink">
                    <Check size={14} /> All {ids.length} recited today
                  </span>
                ) : (
                  <span className="mt-1 text-meta font-semibold tabular">
                    {got > 0 ? `${got} of ${ids.length} recited today` : `${ids.length} recitations`}
                  </span>
                )}
              </span>
              <Chevron className="shrink-0 text-ink-soft transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
