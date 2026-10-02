import type { Metadata } from "next";
import Link from "next/link";
import { citation, entries, SHOW_DRAFTS } from "@/lib/entries";
import { GradeBadge } from "@/components/CitationBadge";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Sources" };

export default function Sources() {
  return (
    <PageShell width="wide">
      <h1 className="t-h1">Sources</h1>
      <p className="mt-2 max-w-[56ch] text-ink-soft">
        Every recitation on RuqyaPro, with the book, the reference, the grade and who graded it. Quranic text comes from the
        Quran.com Uthmani dataset. Hadith text and grades come from a pinned open dataset, cross-checked by the owner.
      </p>
      {SHOW_DRAFTS && <p className="mt-3 text-meta text-[var(--draft)]">Preview: entries not yet verified by the owner are marked as drafts.</p>}

      <ol className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-4">
        {entries.map((e) => (
          <li key={e.id} id={e.id} className="glass-lite cv-auto-card scroll-mt-24 rounded-[28px] border border-line px-5 py-6 text-card-ink">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-h3 leading-tight">{e.title}</h2>
              <span className="text-accent"><GradeBadge entry={e} /></span>
            </div>
            <dl className="mt-4 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-small [&_dd]:[overflow-wrap:anywhere]">
              <dt className="text-card-soft">Cited as</dt><dd>{citation(e)}</dd>
              <dt className="text-card-soft">Chapter</dt><dd>{e.source.chapter || "Not yet recorded"}</dd>
              <dt className="text-card-soft">Graded by</dt><dd>{e.grader || "Not yet recorded"}</dd>
              {e.support.length > 0 && (<><dt className="text-card-soft">Also see</dt><dd>{e.support.map((s) => (s.book === "The Qur'an" ? `Qur'an ${s.ref}` : `${s.book} ${s.ref}`)).join("; ")}</dd></>)}
              {e.exegesis.note && (<><dt className="text-card-soft">Note</dt><dd>{e.exegesis.note}{e.exegesis.work && ` (${e.exegesis.work})`}</dd></>)}
              <dt className="text-card-soft">Verified</dt>
              <dd>{e.verified ? `${e.verified_by}, ${e.verified_on}` : "Not yet"}</dd>
            </dl>
            <details className="mt-3 text-meta text-card-soft">
              <summary className="min-h-11 cursor-pointer content-center">Where each text came from</summary>
              <ul className="mt-1 grid gap-1">
                {Object.entries(e.provenance).map(([k, v]) => (<li key={k}><span className="font-semibold text-card-ink">{k}:</span> {v}</li>))}
              </ul>
            </details>
            <div className="mt-1 flex flex-wrap gap-x-6 text-small">
              <Link href={`/recitations/${e.slug}`} className="inline-flex min-h-11 items-center underline">Read the recitation</Link>
              {e.takhrij_url && <a href={e.takhrij_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">Check the original</a>}
            </div>
          </li>
        ))}
      </ol>
    </PageShell>
  );
}
