"use client";
import Link from "next/link";
import { useState } from "react";
import { Sheet } from "./Sheet";
import type { Entry } from "@/lib/types";
import { UNSOURCED_NOTE, citation, gradeLabel } from "@/lib/entries";

export function GradeBadge({ entry }: { entry: Entry }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-current px-2.5 py-0.5 text-meta font-semibold uppercase tracking-[0.06em]">
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {gradeLabel(entry)}
    </span>
  );
}

/** The citation badge. Click opens the slide-over; no page navigation. */
export function CitationBadge({ entry, tone = "card" }: { entry: Entry; tone?: "card" | "sky" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Source: ${citation(entry)}, graded ${gradeLabel(entry)}. Open details`}
        className={`press-icon inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-full border px-3.5 text-meta transition-colors ${tone === "card" ? "border-line text-card-ink hover:bg-[color-mix(in_oklch,var(--card-ink)_8%,transparent)]" : "border-line hover:bg-[color-mix(in_oklch,var(--ink)_8%,transparent)]"}`}
      >
        {entry.grade !== "Qur'an" && !entry.unsourced && (
          <>
            <span className="shrink-0 font-semibold">{gradeLabel(entry)}</span>
            <span aria-hidden className="shrink-0 opacity-40">|</span>
          </>
        )}
        {/* In a narrow card footer the reference gives way (with an ellipsis) before the buttons beside it do. */}
        <span className="min-w-0 truncate">{citation(entry)}</span>
      </button>
      <Sheet open={open} onOpenChange={setOpen} title={entry.title} description={citation(entry)}>
        {entry.arabic.trim() ? (
          <section aria-labelledby={`arabic-${entry.id}`}>
            <h3 id={`arabic-${entry.id}`} className="sr-only">Arabic text</h3>
            <div className="rounded-[20px] border border-line px-4 py-3">
              {entry.arabic.split("\n").map((l, i) => (
                <p key={i} lang="ar" dir="rtl" className="arabic arabic-sm">{l.trim()}</p>
              ))}
            </div>
          </section>
        ) : (
          <p className="rounded-[20px] border border-line px-4 py-3 text-small">{UNSOURCED_NOTE} There is no Arabic text here yet.</p>
        )}
        {entry.unsourced && entry.arabic.trim() && <p className="mt-3 text-small">{UNSOURCED_NOTE}</p>}

        <dl className="mt-6 grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-3 text-small">
          <dt className="text-card-soft">Grade</dt>
          <dd><GradeBadge entry={entry} /></dd>
          <dt className="text-card-soft">Graded by</dt>
          <dd>{entry.grader || "Not yet recorded"}</dd>
          <dt className="text-card-soft">Book</dt>
          <dd>{entry.source.book}</dd>
          <dt className="text-card-soft">Reference</dt>
          <dd className="tabular">{entry.source.ref}</dd>
          <dt className="text-card-soft">Chapter</dt>
          <dd>{entry.source.chapter || "Not yet recorded"}</dd>
          {entry.support.length > 0 && (
            <>
              <dt className="text-card-soft">Also see</dt>
              <dd className="grid gap-1">
                {entry.support.map((s) => (
                  <span key={s.book + s.ref}>{s.book === "The Qur'an" ? `Qur'an ${s.ref}` : `${s.book} ${s.ref}`}</span>
                ))}
              </dd>
            </>
          )}
        </dl>

        <section className="mt-6">
          <h3 className="text-small font-semibold">Exegetical note</h3>
          {entry.exegesis.note ? (
            <p className="mt-1 text-small leading-relaxed">
              {entry.exegesis.note}
              {entry.exegesis.work && <span className="block text-card-soft">From {entry.exegesis.work}</span>}
            </p>
          ) : (
            <p className="mt-1 text-small text-card-soft">No note has been added for this entry yet.</p>
          )}
        </section>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href={`/sources#${entry.id}`}
            className="btn btn-sm btn-primary"
          >
            Open in Sources
          </Link>
          {entry.takhrij_url && (
            <a href={entry.takhrij_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">
              Check the original
            </a>
          )}
        </div>
      </Sheet>
    </>
  );
}
