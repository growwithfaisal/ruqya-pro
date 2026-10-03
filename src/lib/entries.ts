import raw from "../../data/entries.json";
import type { Entry, Intent, TimeTag } from "./types";

const all = raw as unknown as Entry[];

/**
 * Editorial invariant at read time: only verified entries are public.
 * Drafts are visible in development and when NEXT_PUBLIC_PREVIEW_DRAFTS=1
 * (set it on Vercel Preview, never on Production).
 */
export const SHOW_DRAFTS =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_PREVIEW_DRAFTS === "1";

export const entries: Entry[] = all.filter((e) => e.verified === true || SHOW_DRAFTS);

/** The daily routines (morning, evening, bedtime) are made from the core entries that carry a time. */
export const deckEntries = entries.filter((e) => e.collection === "core");
export const bySlug = (slug: string) => entries.find((e) => e.slug === slug);

/** The five needs on Home and in Recitations. What each holds, and in what order, is in data/library.json (src/lib/library.ts). */
export const INTENTS: { id: Intent; label: string; blurb: string }[] = [
  { id: "daily-protection", label: "Daily Protection", blurb: "Remembrance for each day." },
  { id: "pain", label: "Physical Pain", blurb: "What is reported for when the body hurts." },
  { id: "evil-eye", label: "Evil Eye", blurb: "Seeking refuge from the envious eye." },
  { id: "financial", label: "Financial Blockages", blurb: "Asking Allah for provision and relief from debt." },
  { id: "emotional", label: "Emotional Reset", blurb: "For worry, distress and a heavy heart." },
];

export const SETS: Record<TimeTag, string> = {
  morning: "Morning adhkar",
  evening: "Evening adhkar",
  bedtime: "Bedtime routine",
};

export function gradeLabel(e: Entry) {
  if (e.unsourced) return "No graded source";
  return e.grade === "Qur'an" ? "Qur'an" : e.grade || "Ungraded";
}

export function citation(e: Entry) {
  if (e.unsourced) return "Scholars mention this dua";
  return e.source.book === "The Qur'an" ? `Qur'an ${e.source.ref}` : `${e.source.book} ${e.source.ref}`;
}

/** Shown wherever a dua without a graded source appears. */
export const UNSOURCED_NOTE = "Not from a graded hadith. Scholars mention this dua.";
