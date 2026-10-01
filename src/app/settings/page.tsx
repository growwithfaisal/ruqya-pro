import type { Metadata } from "next";
import { BackupPanel } from "@/components/BackupPanel";
import { PrayerSettings } from "@/components/PrayerSettings";
import { OfflinePanel } from "@/components/OfflinePanel";
import { INTENTS, SETS, entries } from "@/lib/entries";
import { PageShell } from "@/components/PageShell";

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
    <PageShell>
      <h1 className="t-h1">Settings</h1>
      <div className="mt-8">
        <OfflinePanel pages={pages()} />
      </div>
      <div className="mt-12">
        <PrayerSettings />
      </div>
      <div className="mt-12">
        <BackupPanel />
      </div>
      <p className="mt-12 text-meta text-ink-soft">Everything above is kept only on this device. Nothing is sent to a server.</p>
    </PageShell>
  );
}
