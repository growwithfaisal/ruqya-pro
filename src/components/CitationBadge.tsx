"use client";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import type { Entry } from "@/lib/types";
import { citation, gradeLabel } from "@/lib/entries";

export function GradeBadge({ entry }: { entry: Entry }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-current px-2.5 py-0.5 text-[0.78rem] font-semibold uppercase tracking-[0.06em]">
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {gradeLabel(entry)}
    </span>
  );
}

/** The citation badge. Click opens the slide-over; no page navigation. */
export function CitationBadge({ entry, tone = "card" }: { entry: Entry; tone?: "card" | "sky" }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label={`Source: ${citation(entry)}, graded ${gradeLabel(entry)}. Open details`}
        className={`inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3.5 text-[0.9rem] transition-colors ${tone === "card" ? "border-line text-card-ink hover:bg-[color-mix(in_oklch,var(--card-ink)_8%,transparent)]" : "border-line hover:bg-[color-mix(in_oklch,var(--ink)_8%,transparent)]"}`}
      >
        {entry.grade !== "Qur'an" && (
          <>
            <span className="font-semibold">{gradeLabel(entry)}</span>
            <span aria-hidden className="opacity-40">|</span>
          </>
        )}
        <span className="whitespace-nowrap">{citation(entry)}</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay fixed inset-0 z-40 bg-black/45" />
        <Dialog.Content className="drawer-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[28px] border border-line bg-card text-card-ink shadow-[0_-16px_48px_-16px_rgb(0_0_0/0.4)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[30rem] md:rounded-l-[28px] md:rounded-tr-none">
          <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
            <div>
              <Dialog.Title className="display text-[1.5rem] leading-tight">{entry.title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-[0.95rem] text-card-soft">
                {citation(entry)}
              </Dialog.Description>
            </div>
            <Dialog.Close className="min-h-11 shrink-0 rounded-full border border-line px-4 text-[0.9rem]">Close</Dialog.Close>
          </div>

          <div className="overflow-y-auto px-6 pb-8">
            <section aria-labelledby={`arabic-${entry.id}`}>
              <h3 id={`arabic-${entry.id}`} className="sr-only">Arabic text</h3>
              <div className="rounded-2xl border border-line px-4 py-3">
                {entry.arabic.split("\n").map((l, i) => (
                  <p key={i} lang="ar" dir="rtl" className="arabic arabic-sm">{l.trim()}</p>
                ))}
              </div>
            </section>

            <dl className="mt-6 grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-3 text-[0.95rem]">
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
              <h3 className="text-[0.95rem] font-semibold">Exegetical note</h3>
              {entry.exegesis.note ? (
                <p className="mt-1 text-[0.95rem] leading-relaxed">
                  {entry.exegesis.note}
                  {entry.exegesis.work && <span className="block text-card-soft">From {entry.exegesis.work}</span>}
                </p>
              ) : (
                <p className="mt-1 text-[0.95rem] text-card-soft">No note has been added for this entry yet.</p>
              )}
            </section>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={`/sources#${entry.id}`}
                className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-accent-ink no-underline"
              >
                Open in Sources
              </Link>
              {entry.takhrij_url && (
                <a href={entry.takhrij_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 no-underline">
                  Check the original
                </a>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
