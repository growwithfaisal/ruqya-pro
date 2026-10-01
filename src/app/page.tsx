import { SkyHero } from "@/components/SkyHero";
import { IntentList } from "@/components/IntentList";
import { entries } from "@/lib/entries";
import type { TimeTag } from "@/lib/types";

export default function Home() {
  const setIds: Record<TimeTag, string[]> = { morning: [], evening: [], bedtime: [] };
  for (const e of entries) for (const t of e.times) setIds[t].push(e.id);

  return (
    <>
      <SkyHero setIds={setIds} />
      <IntentList />
    </>
  );
}
