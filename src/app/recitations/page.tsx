import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryList } from "@/components/CategoryList";
import { RoutineReader } from "@/components/RoutineReader";
import { INTENTS, SETS, deckEntries } from "@/lib/entries";
import type { Intent, TimeTag } from "@/lib/types";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Recitations" };

const SET_IDS = ["morning", "evening", "bedtime"];

export default async function Recitations({ searchParams }: PageProps<"/recitations">) {
  const sp = await searchParams;
  const intent = String(sp.intent ?? "");
  const set = String(sp.set ?? "");

  // A daily routine opens in the one-card reader and returns to Home.
  if (SET_IDS.includes(set)) {
    const tag = set as TimeTag;
    return (
      <Suspense>
        <RoutineReader set={tag} title={SETS[tag]} entries={deckEntries.filter((e) => e.times.includes(tag))} />
      </Suspense>
    );
  }

  // A category opens the same way, with its own progress, and returns to this tab.
  const cat = INTENTS.find((i) => i.id === intent);
  if (cat) {
    return (
      <Suspense>
        <RoutineReader set={cat.id} title={cat.label} entries={deckEntries.filter((e) => e.category.includes(cat.id))} exit="/recitations" />
      </Suspense>
    );
  }

  return (
    <PageShell>
      <h1 className="t-h1">Recitations</h1>
      <p className="mt-2 max-w-[52ch] text-ink-soft">Choose what you need. Each opens one recitation at a time, with its source, and remembers what you have recited today.</p>
      <div className="mt-6">
        <CategoryList ids={Object.fromEntries(INTENTS.map((i) => [i.id, deckEntries.filter((e) => e.category.includes(i.id)).map((e) => e.id)])) as Record<Intent, string[]>} />
      </div>
    </PageShell>
  );
}
