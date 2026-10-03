import raw from "../../data/library.json";
import { entries } from "./entries";
import type { Entry, Intent } from "./types";

/**
 * The owner's lists, in the owner's order: what each Recitations section holds and what Self-Ruqyah shows. Built by
 * scripts/import-content.mts into data/library.json. An entry can sit in several lists with a different count in each, so
 * the count lives here and not on the entry. A list item can also carry its own title where one dua has two names.
 */
export interface Count { times?: number; text?: string; basis: string | null }
export interface Item { id: string; title?: string; count?: Count }
export interface PrepStep { text: string; source?: { label: string; grade?: string; href: string }; entryId?: string }

const lib = raw as unknown as {
  categories: Record<Intent, Item[]>;
  selfRuqyah: { preparation: PrepStep[]; ayat: Item[]; duas: Item[] };
};

const NUMBER = ["", "Once", "Twice", "Three times", "Four times", "Five times", "Six times", "Seven times", "Eight times", "Nine times", "Ten times"];
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const countWhat = (c: Count) => c.text ?? (c.times && NUMBER[c.times] ? NUMBER[c.times] : `${c.times} times`);

/** "Three times · Tirmidhi 3388" where a sound hadith says it, "Suggested: seven times" where none does. */
export function countLabel(c: Count): string {
  const what = countWhat(c);
  return c.basis ? `${what} · ${c.basis}` : `Suggested: ${lower(what)}`;
}

/** The same count in two parts, for the reader's label: the number first, then its source or "Suggested". */
export const countParts = (c: Count) => ({ what: countWhat(c), note: c.basis ?? "Suggested" });

/** The entries of a list, each with this list's title and count in place of its own. */
export function resolve(items: Item[]): Entry[] {
  const out: Entry[] = [];
  for (const i of items) {
    const e = entries.find((x) => x.id === i.id);
    if (e) out.push({ ...e, title: i.title ?? e.title, repeat: i.count ? countLabel(i.count) : "", countParts: i.count ? countParts(i.count) : undefined });
  }
  return out;
}

export const categoryEntries = (id: Intent): Entry[] => resolve(lib.categories[id] ?? []);
export const preparation: PrepStep[] = lib.selfRuqyah.preparation;
export const ruqyahAyat = (): Entry[] => resolve(lib.selfRuqyah.ayat);
export const ruqyahDuas = (): Entry[] => resolve(lib.selfRuqyah.duas);
