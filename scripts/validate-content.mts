/**
 * Editorial invariant. Fails the build when a published entry (verified === true)
 * breaks the rules, and when any entry is structurally malformed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Entry } from "../src/lib/types.ts";

const ALLOWED_GRADES = new Set(["Sahih", "Hasan", "Qur'an"]);
const COLLECTIONS = new Set(["core", "ayat-list", "verse"]);
const INTENTS = new Set(["daily-protection", "pain", "evil-eye", "learning"]);
const TIMES = new Set(["morning", "evening", "bedtime"]);

const entries: Entry[] = JSON.parse(readFileSync(join(import.meta.dirname, "..", "data", "entries.json"), "utf8"));
const errors: string[] = [];
const err = (e: Entry, msg: string) => errors.push(`${e.id ?? "?"} ${e.title ?? ""}: ${msg}`);

const ids = new Set<string>();
const slugs = new Set<string>();
let published = 0;
let drafts = 0;

for (const e of entries) {
  // structure, always
  for (const k of ["id", "slug", "title", "arabic"] as const) if (!String(e[k] ?? "").trim()) err(e, `missing ${k}`);
  if (ids.has(e.id)) err(e, "duplicate id");
  if (slugs.has(e.slug)) err(e, "duplicate slug");
  ids.add(e.id); slugs.add(e.slug);
  if (!COLLECTIONS.has(e.collection)) err(e, "bad collection");
  if (!Array.isArray(e.category) || e.category.some((c) => !INTENTS.has(c))) err(e, "bad category");
  if (!Array.isArray(e.times) || e.times.some((t) => !TIMES.has(t))) err(e, "bad times");
  if (e.grade && !ALLOWED_GRADES.has(e.grade)) err(e, `grade "${e.grade}" is not one of ${[...ALLOWED_GRADES].join(", ")}`);

  if (e.verified !== true) { drafts++; continue; }

  // published entries
  published++;
  if (!e.source?.book || !e.source?.ref) err(e, "published without a source (book, ref)");
  if (!ALLOWED_GRADES.has(e.grade)) err(e, "published without an allowed grade");
  if (!e.grader?.trim()) err(e, "published without a grader");
  if (!e.verified_by?.trim() || !e.verified_on?.trim()) err(e, "published without verified_by / verified_on");
  if (!e.transliteration?.trim()) err(e, "published without transliteration");
  if (!e.translation?.trim()) err(e, "published without translation");
  if (!e.takhrij_url?.trim()) err(e, "published without takhrij_url");
}

if (errors.length) {
  console.error(`\nContent validation failed (${errors.length}):\n` + errors.map((m) => "  - " + m).join("\n") + "\n");
  process.exit(1);
}
console.log(`Content OK: ${entries.length} entries, ${published} published, ${drafts} awaiting owner verification.`);
