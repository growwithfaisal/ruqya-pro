import type { Metadata } from "next";
import { Suspense } from "react";
import { Deck } from "@/components/Deck";
import { deckEntries } from "@/lib/entries";
import type { Intent, TimeTag } from "@/lib/types";

export const metadata: Metadata = { title: "Recitations" };

const INTENT_IDS = ["daily-protection", "pain", "evil-eye", "learning"];
const SET_IDS = ["morning", "evening", "bedtime"];

export default async function Recitations({ searchParams }: PageProps<"/recitations">) {
  const sp = await searchParams;
  const intent = String(sp.intent ?? "");
  const set = String(sp.set ?? "");
  const initial = {
    intent: (INTENT_IDS.includes(intent) ? intent : "all") as Intent | "all",
    set: (SET_IDS.includes(set) ? set : "") as TimeTag | "",
  };
  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-6 md:px-8 md:pt-12">
        <h1 className="display text-[clamp(1.8rem,6vw,3rem)] leading-tight">Recitations</h1>
        <p className="mt-2 hidden max-w-[52ch] text-ink-soft sm:block">Each card carries its source. Tap the citation to see the grade, the book and the chapter.</p>
      </div>
      <Suspense>
        <Deck entries={deckEntries} initial={initial} />
      </Suspense>
    </>
  );
}
