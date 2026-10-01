import { SkyHero } from "@/components/SkyHero";
import { AyahOfTheDay } from "@/components/AyahOfTheDay";
import { Disclaimer } from "@/components/Disclaimer";
import { entries } from "@/lib/entries";
import type { TimeTag } from "@/lib/types";

export default function Home() {
  const setIds: Record<TimeTag, string[]> = { morning: [], evening: [], bedtime: [] };
  for (const e of entries) for (const t of e.times) setIds[t].push(e.id);

  return (
    <>
      <SkyHero setIds={setIds} />
      <AyahOfTheDay />
      <section aria-label="Medical note" className="mx-auto max-w-2xl px-4 pt-10 md:px-8">
        <Disclaimer className="text-center" />
      </section>
    </>
  );
}
