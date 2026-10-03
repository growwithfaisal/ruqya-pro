"use client";
import Fuse from "fuse.js";
import Link from "next/link";
import { Chevron } from "./Glyphs";
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
        keys: ["title", "translation", "transliteration", "source.book", "source.ref", "source.chapter", "practice"],
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
            <Link href={`/recitations/${e.slug}`} className="press-row group -mx-3 flex min-h-[4.5rem] items-center gap-3 rounded-2xl px-3 py-3 no-underline">
              <span className="grid flex-1">
                <span className="display text-title leading-tight">{e.title}</span>
                <span className="text-meta text-ink-soft">{citation(e)}</span>
              </span>
              <Chevron className="shrink-0 text-ink-soft transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
      {q.trim() && results.length === 0 && <p className="mt-6 text-ink-soft">Nothing matches that yet.</p>}
    </div>
  );
}
