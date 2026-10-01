import type { Metadata } from "next";
import { SearchBox } from "@/components/SearchBox";
import { entries } from "@/lib/entries";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Search" };

export default function Search() {
  return (
    <PageShell>
      <h1 className="t-h1">Search</h1>
      <p className="mb-6 mt-2 text-ink-soft">Searches the titles, translations and sources on this device. Nothing is sent anywhere.</p>
      <SearchBox entries={entries} />
    </PageShell>
  );
}
