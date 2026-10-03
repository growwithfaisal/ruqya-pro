import type { Entry } from "@/lib/types";
import type { PrepStep } from "@/lib/library";
import { EntryDisclosure } from "./EntryDisclosure";

/** The five things to do first. A step carries a source only where our data has one; the rest are plain guidance. */
export function Preparation({ steps, entries }: { steps: PrepStep[]; entries: Entry[] }) {
  return (
    <section className="mt-12" aria-labelledby="prep-title">
      <h2 id="prep-title" className="t-h2">Preparation</h2>
      <p className="mt-2 max-w-[56ch] text-ink-soft">Five things to do before you begin.</p>
      <ol className="mt-5 border-t border-line">
        {steps.map((s, i) => {
          const entry = s.entryId ? entries.find((e) => e.id === s.entryId) : undefined;
          return (
            <li key={i} className="flex gap-4 border-b border-line py-4">
              <span aria-hidden className="display w-8 shrink-0 text-title leading-tight text-accent tabular">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-lead leading-snug">{s.text}</p>
                {s.source && (
                  <p className="mt-1 text-meta text-ink-soft">
                    {s.source.href.startsWith("/") ? (
                      <a href={s.source.href} className="underline">{s.source.label}</a>
                    ) : (
                      <a href={s.source.href} target="_blank" rel="noreferrer" className="underline">{s.source.label}</a>
                    )}
                    {s.source.grade ? `, ${s.source.grade}` : ""}
                  </p>
                )}
                {entry && <div className="mt-2 border-t border-line"><EntryDisclosure entry={entry} /></div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
