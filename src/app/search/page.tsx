import type { Metadata } from "next";
import { SearchBox } from "@/components/SearchBox";
import { entries } from "@/lib/entries";

export const metadata: Metadata = { title: "Search" };

export default function Search() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 md:px-8 md:pt-12">
      <h1 className="display text-[clamp(2rem,6vw,3rem)] leading-tight">Search</h1>
      <p className="mb-6 mt-2 text-ink-soft">Searches the titles, translations and sources on this device. Nothing is sent anywhere.</p>
      <SearchBox entries={entries} />
    </div>
  );
}
