"use client";
import Fuse from "fuse.js";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Entry } from "@/lib/types";
import { citation } from "@/lib/entries";

export function SearchBox({ entries }: { entries: Entry[] }) {
  const [q, setQ] = useState("");
  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        threshold: 0.35,
        ignoreLocation: true,
        keys: ["title", "translation", "transliteration", "source.book", "source.ref", "practice"],
      }),
    [entries],
  );
  const results = q.trim() ? fuse.search(q.trim()).map((r) => r.item) : [];

  return (
    <div>
      <label htmlFor="q" className="sr-only">Search recitations</label>
      <input
        id="q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Try “sleep”, “Bukhari” or “evil eye”"
        className="min-h-14 w-full glass-chip rounded-full border border-line px-6 text-lead text-card-ink placeholder:text-card-soft"
        autoComplete="off"
      />
      <ul className="mt-6 border-t border-line" aria-live="polite">
        {results.map((e) => (
          <li key={e.id} className="border-b border-line">
            <Link href={`/recitations/${e.slug}`} className="block py-4 no-underline">
              <span className="display block text-title leading-tight">{e.title}</span>
              <span className="text-meta text-ink-soft">{citation(e)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {q.trim() && results.length === 0 && <p className="mt-6 text-ink-soft">Nothing matches that yet.</p>}
    </div>
  );
}
