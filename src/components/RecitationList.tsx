"use client";
import Fuse from "fuse.js";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Entry, Intent } from "@/lib/types";
import { citation, gradeLabel } from "@/lib/entries";
import { Chevron, Search } from "./Glyphs";

type Tab = Intent | "all";
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "daily-protection", label: "Protection" },
  { id: "pain", label: "Pain" },
  { id: "evil-eye", label: "Evil eye" },
  { id: "learning", label: "Learning" },
];

/** The recitations as a list, in the same style as the Qur'an tab: tabs, search, then one row per recitation that opens it. */
export function RecitationList({ entries, initial }: { entries: Entry[]; initial: Tab }) {
  const [tab, setTab] = useState<Tab>(initial);
  const [term, setTerm] = useState("");
  const strip = useRef<HTMLDivElement>(null);
  // Keep the chosen tab in view when the strip scrolls sideways (for example when arriving with ?intent=learning).
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab]);

  const fuse = useMemo(
    () => new Fuse(entries, { threshold: 0.32, ignoreLocation: true, keys: ["title", "translation", "transliteration", "source.book", "source.ref", "practice"] }),
    [entries],
  );
  const pool = tab === "all" ? entries : entries.filter((e) => e.category.includes(tab));
  const t = term.trim();
  const list = t ? fuse.search(t).map((r) => r.item).filter((e) => pool.includes(e)) : pool;

  const choose = (next: Tab) => {
    setTab(next);
    history.replaceState(null, "", next === "all" ? location.pathname : `?intent=${next}`);
  };

  return (
    <div>
      <div ref={strip} className="no-scrollbar flex overflow-x-auto rounded-full border border-line p-1" role="tablist" aria-label="Browse by need">
        {TABS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => choose(x.id)}
            className={`min-h-11 shrink-0 grow rounded-full px-4 text-base font-semibold transition-colors ${tab === x.id ? "bg-accent text-accent-ink" : ""}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <label className="relative mt-3 block">
        <span className="sr-only">Search recitations</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search a recitation"
          autoComplete="off"
          className="field pl-11 placeholder:text-ink-soft"
        />
      </label>

      {list.length ? (
        <ul className="mt-4 grid gap-2.5" aria-live="polite">
          {list.map((e) => (
            <li key={e.id} className="rounded-[20px] border border-line">
              <Link href={`/recitations/${e.slug}`} className="group flex min-h-[4.5rem] items-center gap-3 px-4 py-3 no-underline">
                <span className="grid flex-1">
                  <span className="display text-title leading-tight">{e.title}</span>
                  <span className="text-meta text-ink-soft">{citation(e)}</span>
                </span>
                <span className="text-meta text-ink-soft">{gradeLabel(e)}</span>
                <Chevron className="shrink-0 text-ink-soft transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-center text-ink-soft">{t ? "No recitation matches that." : "Nothing to show here yet."}</p>
      )}
    </div>
  );
}
