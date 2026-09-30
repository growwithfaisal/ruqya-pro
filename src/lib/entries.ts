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

/** The swipe deck holds the core recitations only. */
export const deckEntries = entries.filter((e) => e.collection === "core");
export const ayatList = entries.filter((e) => e.collection === "ayat-list");
export const namedVerses = entries.filter((e) => e.collection === "verse");
/** Hadith-sourced duas that are not in the daily-set flow of the deck are still listed on Self-Ruqyah. */
export const bySlug = (slug: string) => entries.find((e) => e.slug === slug);

export const INTENTS: { id: Intent; label: string; blurb: string }[] = [
  { id: "daily-protection", label: "Daily protection", blurb: "Morning, evening and bedtime remembrance." },
  { id: "pain", label: "Physical pain", blurb: "What is reported for when the body hurts." },
  { id: "evil-eye", label: "Suspected evil eye", blurb: "Seeking refuge from the envious eye." },
  { id: "learning", label: "Learning self-ruqyah", blurb: "The core recitations, one at a time." },
];

export const SETS: Record<TimeTag, string> = {
  morning: "Morning adhkar",
  evening: "Evening adhkar",
  bedtime: "Bedtime routine",
};

export function gradeLabel(e: Entry) {
  return e.grade === "Qur'an" ? "Qur'an" : e.grade || "Ungraded";
}

export function citation(e: Entry) {
  return e.source.book === "The Qur'an" ? `Qur'an ${e.source.ref}` : `${e.source.book} ${e.source.ref}`;
}
