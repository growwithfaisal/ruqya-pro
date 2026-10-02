import Link from "next/link";
import { INTENTS } from "@/lib/entries";
import { Chevron, INTENT_GLYPH as GLYPH } from "./Glyphs";

export function IntentList() {
  return (
    <section aria-labelledby="intent-title" className="mx-auto max-w-5xl px-4 pt-14 md:px-8 md:pt-20">
      <div className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:gap-16">
        <div>
          <h2 id="intent-title" className="t-h2-lead">What brings you here today?</h2>
        </div>
        <ul className="border-t border-line">
          {INTENTS.map((it, i) => {
            const Glyph = GLYPH[it.id];
            return (
              <li key={it.id} className="rise border-b border-line" style={{ ["--i" as string]: i + 2 }}>
                <Link
                  href={`/recitations?intent=${it.id}`}
                  className="group flex min-h-[5.25rem] items-center gap-4 py-4 no-underline transition-colors"
                >
                  <Glyph className="shrink-0 text-accent" size={30} />
                  <span className="grid flex-1">
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
