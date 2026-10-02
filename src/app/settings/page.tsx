import type { Metadata } from "next";
import { BackupPanel } from "@/components/BackupPanel";
import { PrayerSettings } from "@/components/PrayerSettings";
import { OfflinePanel } from "@/components/OfflinePanel";
import { NightSwitch } from "@/components/NightMode";
import { ReadingSettings } from "@/components/ReadingSettings";
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

/** The sections, most used first. Each id is the heading of that section. */
const JUMPS = [
  ["Reading", "reading-title"],
  ["Prayer times", "prayer-settings-title"],
  ["Offline", "offline-title"],
  ["Backup", "backup-title"],
] as const;

export default function Settings() {
  return (
    <PageShell>
      <h1 className="t-h1">Settings</h1>
      <nav aria-label="Sections" className="mt-5">
        <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {JUMPS.map(([label, id]) => (
            <li key={id}><a href={`#${id}`} className="btn btn-sm btn-secondary w-full !px-4 no-underline sm:w-auto">{label}</a></li>
          ))}
        </ul>
      </nav>
      <div className="mt-8">
        <NightSwitch />
      </div>
      <div className="mt-10">
        <ReadingSettings />
      </div>
      <div className="mt-12">
        <PrayerSettings />
      </div>
      <div className="mt-12">
        <OfflinePanel pages={pages()} />
      </div>
      <div className="mt-12">
        <BackupPanel />
      </div>
      <p className="mt-12 text-meta text-ink-soft">Everything above is kept only on this device. Nothing is sent to a server.</p>
    </PageShell>
  );
}
