import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UNSOURCED_NOTE, bySlug, citation, entries } from "@/lib/entries";
import { Translit } from "@/components/Translit";
import { CitationBadge, GradeBadge } from "@/components/CitationBadge";
import { PageShell } from "@/components/PageShell";

export function generateStaticParams() {
  return entries.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/recitations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = bySlug(slug);
  return { title: e?.title ?? "Recitation" };
}

export default async function Reader({ params }: PageProps<"/recitations/[slug]">) {
  const { slug } = await params;
  const e = bySlug(slug);
  if (!e) notFound();
  const i = entries.findIndex((x) => x.id === e.id);
  const prev = entries[i - 1];
  const next = entries[i + 1];

  return (
    <PageShell as="article">
      <p className="text-small"><Link href="/recitations" className="underline">All recitations</Link></p>
      <h1 className="t-h1 mt-4">{e.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-accent"><GradeBadge entry={e} /></span>
        <CitationBadge entry={e} tone="sky" />
      </div>

      {e.arabic.trim() && (
        <div className="mt-8 rounded-[28px] glass border border-line px-5 py-8 text-card-ink">
          {e.arabic.split("\n").map((l, k) => (
            <p key={k} lang="ar" dir="rtl" className="arabic">{l.trim()}</p>
          ))}
        </div>
      )}
      {e.unsourced && <p className="mt-6 max-w-[65ch] text-lead">{UNSOURCED_NOTE}</p>}

      {e.transliteration && (
        <section className="mt-8">
          <h2 className="text-small font-semibold text-ink-soft">Transliteration</h2>
          <div className="mt-1 max-w-[65ch] text-[calc(1rem*var(--translit-scale))] italic leading-relaxed">{e.transliteration.split("\n").map((l, k, all) => <p key={k}>{all.length === 1 ? <Translit text={l} marks={e.tu} silent={e.ts} /> : l}</p>)}</div>
        </section>
      )}
      {e.translation && (
        <section className="mt-8">
          <h2 className="text-small font-semibold text-ink-soft">Translation</h2>
          <div className="mt-1 max-w-[65ch] text-lead leading-relaxed">{e.translation.split("\n").map((l, k) => <p key={k}>{l}</p>)}</div>
        </section>
      )}
      {(e.practice || e.repeat) && (
        <section className="mt-8">
          <h2 className="text-small font-semibold text-ink-soft">{e.practice ? "How" : "Times"}</h2>
          <p className="mt-1 max-w-[65ch]">{e.practice}{e.practice && e.repeat ? " " : ""}{e.repeat}</p>
        </section>
      )}
      <p className="mt-8 text-ink-soft">Source: {citation(e)}. <Link href={`/sources#${e.id}`} className="underline">Full details</Link></p>

      <nav aria-label="More recitations" className="mt-12 flex justify-between gap-4 border-t border-line pt-6">
        {prev ? <Link href={`/recitations/${prev.slug}`} className="min-h-11 underline">Previous: {prev.title}</Link> : <span />}
        {next ? <Link href={`/recitations/${next.slug}`} className="min-h-11 text-right underline">Next: {next.title}</Link> : <span />}
      </nav>
    </PageShell>
  );
}
