import type { Metadata } from "next";
import { OfflinePanel } from "@/components/OfflinePanel";
import { INTENTS, SETS, entries } from "@/lib/entries";

export const metadata: Metadata = { title: "Settings" };

/** Every page that should work offline once downloaded. */
function pages() {
  return [
    "/", "/quran", "/quran/read", "/recitations", "/self-ruqyah", "/sources", "/search", "/settings",
    ...Object.keys(SETS).map((s) => `/recitations?set=${s}`),
    ...INTENTS.map((i) => `/recitations?intent=${i.id}`),
    ...entries.map((e) => `/recitations/${e.slug}`),
  ];
}

export default function Settings() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-4 pt-8 md:px-8 md:pt-12">
      <h1 className="display text-[clamp(2rem,6vw,3rem)] leading-tight">Settings</h1>
      <div className="mt-8">
        <OfflinePanel pages={pages()} />
      </div>
    </div>
  );
}
