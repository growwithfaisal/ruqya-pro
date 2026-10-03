import Link from "next/link";
import { INTENTS } from "@/lib/entries";
import { Chevron, INTENT_GLYPH as GLYPH } from "./Glyphs";

export function IntentList() {
  return (
    <section aria-labelledby="intent-title" className="mx-auto max-w-5xl px-4 pt-14 md:px-8 md:pt-20">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div>
          <h2 id="intent-title" className="t-h2-lead">What brings you here today?</h2>
        </div>
        <ul className="border-t border-line md:grid md:grid-cols-2 md:gap-x-10 lg:block">
          {INTENTS.map((it, i) => {
            const Glyph = GLYPH[it.id];
            return (
              <li key={it.id} className="rise border-b border-line" style={{ ["--i" as string]: i + 2 }}>
                <Link
                  href={`/recitations?intent=${it.id}`}
                  className="press-row group -mx-3 flex min-h-[5.25rem] items-center gap-4 rounded-2xl px-3 py-4 no-underline"
                >
                  <Glyph className="shrink-0 text-accent" size={30} />
                  <span className="grid min-w-0 flex-1">
                    <span className="display text-title leading-tight">{it.label}</span>
                    <span className="text-small text-ink-soft">{it.blurb}</span>
                  </span>
                  <Chevron className="shrink-0 text-ink-soft transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
