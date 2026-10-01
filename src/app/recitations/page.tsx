import type { Metadata } from "next";
import { Suspense } from "react";
import { RecitationList } from "@/components/RecitationList";
import { RoutineReader } from "@/components/RoutineReader";
import { deckEntries } from "@/lib/entries";
import type { Intent, TimeTag } from "@/lib/types";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Recitations" };

const INTENT_IDS = ["daily-protection", "pain", "evil-eye", "learning"];
const SET_IDS = ["morning", "evening", "bedtime"];

export default async function Recitations({ searchParams }: PageProps<"/recitations">) {
  const sp = await searchParams;
  const intent = String(sp.intent ?? "");
  const set = String(sp.set ?? "");

  // A daily routine opens in the one-card reader; browsing by need is a list, like the Qur'an tab.
  if (SET_IDS.includes(set)) {
    const tag = set as TimeTag;
    return (
      <Suspense>
        <RoutineReader set={tag} entries={deckEntries.filter((e) => e.times.includes(tag))} />
      </Suspense>
    );
  }

  const initial = (INTENT_IDS.includes(intent) ? intent : "all") as Intent | "all";
  return (
    <PageShell>
      <h1 className="t-h1">Recitations</h1>
      <p className="mt-2 max-w-[52ch] text-ink-soft">Each recitation carries its source. Open one to read it and see the grade, the book and the chapter.</p>
      <div className="mt-6">
        <Suspense>
          <RecitationList entries={deckEntries} initial={initial} />
        </Suspense>
      </div>
    </PageShell>
  );
}
