export type Grade = "Sahih" | "Hasan" | "Qur'an";

export type Intent =
  | "daily-protection"
  | "pain"
  | "evil-eye"
  | "learning";

export type TimeTag = "morning" | "evening" | "bedtime";

/**
 * core: the swipe deck. ayat-list: passages from the owner's ruqyah ayat list.
 * verse: single verses named in the owner's dua collection. Both of the latter live on Self-Ruqyah.
 */
export type Collection = "core" | "ayat-list" | "verse";

export interface EntrySource {
  book: string;
  ref: string;
  chapter: string;
}

export interface Entry {
  id: string;
  slug: string;
  collection: Collection;
  /** Read one verse at a time inside a daily routine (long Qur'an passages such as Surah Al-Mulk). */
  verseByVerse?: boolean;
  title: string;
  category: Intent[];
  times: TimeTag[];
  /** Arabic exactly as sourced. Lines are joined with \n. */
  arabic: string;
  transliteration: string;
  /** [start, end) ranges over `transliteration` to underline (heavy-letter consonants and long vowels). Qur'an text only. */
  tu?: [number, number][];
  /** [start, end) ranges over `transliteration` for letters that are not said (hamzat wasl when joined, the lam of al- before a sun letter). */
  ts?: [number, number][];
  translation: string;
  /** Plain-language practice note, faithful to the cited source. */
  practice: string;
  repeat: string;
  source: EntrySource;
  /** Supporting citation for the practice (e.g. hadith that commends a Quranic passage). */
  support: EntrySource[];
  grade: Grade | "";
  grader: string;
  exegesis: { work: string; note: string };
  takhrij_url: string;
  /** Where each text field came from. */
  provenance: Record<string, string>;
  verified: boolean;
  verified_by: string;
  verified_on: string;
}
