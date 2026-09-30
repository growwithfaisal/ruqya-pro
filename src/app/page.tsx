import { SkyHero } from "@/components/SkyHero";
import { IntentList } from "@/components/IntentList";
import { entries, SHOW_DRAFTS } from "@/lib/entries";
import type { TimeTag } from "@/lib/types";

export default function Home() {
  const setIds: Record<TimeTag, string[]> = { morning: [], evening: [], bedtime: [] };
  for (const e of entries) for (const t of e.times) setIds[t].push(e.id);

  return (
    <>
      <SkyHero setIds={setIds} />
      <IntentList />
      {SHOW_DRAFTS && (
        <section className="mx-auto max-w-5xl px-4 pt-16 md:px-8" aria-labelledby="essentials-title">
          <h2 id="essentials-title" className="display text-[clamp(1.6rem,4.5vw,2.2rem)]">The essentials</h2>
          <p className="mt-2 max-w-[60ch] rounded-lg border border-dashed border-[var(--draft)] px-3 py-2 text-[0.9rem] text-[var(--draft)]">
            Preview only. Definition, the three conditions, permissible and impermissible practice, and tawheed are written from
            &quot;A Comprehensive Ruqyah Guide&quot;, which has not been supplied. Nothing has been drafted from memory.
          </p>
        </section>
      )}
    </>
  );
}
