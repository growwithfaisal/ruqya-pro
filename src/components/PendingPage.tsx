import Link from "next/link";
import { SHOW_DRAFTS } from "@/lib/entries";

export function PendingPage({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 md:px-8 md:pt-12">
      <h1 className="display text-[clamp(2rem,6vw,3rem)] leading-tight">{title}</h1>
      <p className="mt-2 text-ink-soft">{blurb}.</p>
      <p className="mt-8 max-w-[52ch] text-[1.05rem]">This section is being written and sourced. It will appear here once every claim has a citation.</p>
      {SHOW_DRAFTS && (
        <p className="mt-4 max-w-[60ch] rounded-lg border border-dashed border-[var(--draft)] px-3 py-2 text-[0.9rem] text-[var(--draft)]">
          Preview: this page is built from &quot;A Comprehensive Ruqyah Guide&quot;, which has not been supplied. No religious guidance has been drafted from memory.
        </p>
      )}
      <p className="mt-8"><Link href="/recitations" className="underline">Go to the recitations</Link></p>
    </div>
  );
}
