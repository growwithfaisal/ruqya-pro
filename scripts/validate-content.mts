/**
 * Editorial invariant. Fails the build when a published entry (verified === true)
 * breaks the rules, and when any entry is structurally malformed.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Entry } from "../src/lib/types.ts";

const ALLOWED_GRADES = new Set(["Sahih", "Hasan", "Qur'an"]);
const COLLECTIONS = new Set(["core", "ayat-list", "verse"]);
const INTENTS = ["daily-protection", "pain", "evil-eye", "financial", "emotional"];
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
  for (const k of ["id", "slug", "title"] as const) if (!String(e[k] ?? "").trim()) err(e, `missing ${k}`);
  // Arabic is required, except for a dua kept at the owner's request with no graded source, which must then say so and show a transliteration.
  if (e.unsourced) {
    // Arabic is allowed only where the owner supplied it and the entry says so; it still has no grade and can never be verified.
    if (e.arabic.trim() && !/supplied by the owner/i.test(e.provenance?.arabic ?? "")) err(e, "an unsourced entry may carry Arabic only if its provenance records that the owner supplied it");
    if (!e.transliteration?.trim()) err(e, "an unsourced entry needs its transliteration");
    if (e.grade) err(e, "an unsourced entry cannot have a grade");
  } else if (!String(e.arabic ?? "").trim()) err(e, "missing arabic");
  if (ids.has(e.id)) err(e, "duplicate id");
  if (slugs.has(e.slug)) err(e, "duplicate slug");
  ids.add(e.id); slugs.add(e.slug);
  if (!COLLECTIONS.has(e.collection)) err(e, "bad collection");
  if (!Array.isArray(e.times) || e.times.some((t) => !TIMES.has(t))) err(e, "bad times");
  if (e.grade && !ALLOWED_GRADES.has(e.grade)) err(e, `grade "${e.grade}" is not one of ${[...ALLOWED_GRADES].join(", ")}`);

  if (e.unsourced && e.verified === true) err(e, "an unsourced entry cannot be published as verified");
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

// The owner's lists (data/library.json): every item is a real entry, nothing twice in one list, every count says where it comes from or that it is suggested.
{
  const file = join(import.meta.dirname, "..", "data", "library.json");
  if (!existsSync(file)) errors.push("data/library.json is missing: run npx tsx scripts/import-content.mts");
  else {
    const lib = JSON.parse(readFileSync(file, "utf8")) as { categories: Record<string, { id: string; count?: { times?: number; text?: string; basis: string | null } }[]>; selfRuqyah: { preparation: { text: string; entryId?: string }[]; ayat: { id: string }[]; duas: { id: string }[] } };
    const known = new Set(entries.map((e) => e.id));
    const check = (name: string, list: { id: string; count?: { times?: number; text?: string; basis: string | null } }[]) => {
      const seen = new Set<string>();
      for (const i of list) {
        if (!known.has(i.id)) errors.push(`library ${name}: ${i.id} is not an entry`);
        if (seen.has(i.id)) errors.push(`library ${name}: ${i.id} appears twice`);
        seen.add(i.id);
        if (i.count && !i.count.times && !i.count.text) errors.push(`library ${name}: ${i.id} has a count with no number`);
        if (i.count && i.count.basis !== null && !String(i.count.basis).trim()) errors.push(`library ${name}: ${i.id} has an empty count source`);
      }
    };
    for (const id of INTENTS) { if (!lib.categories[id]?.length) errors.push(`library: section ${id} is empty or missing`); else check(id, lib.categories[id]); }
    for (const id of Object.keys(lib.categories)) if (!INTENTS.includes(id)) errors.push(`library: unknown section ${id}`);
    check("self-ruqyah ayat", lib.selfRuqyah.ayat);
    check("self-ruqyah duas", lib.selfRuqyah.duas);
    for (const p of lib.selfRuqyah.preparation) if (p.entryId && !known.has(p.entryId)) errors.push(`library preparation: ${p.entryId} is not an entry`);
  }
}

if (errors.length) {
  console.error(`\nContent validation failed (${errors.length}):\n` + errors.map((m) => "  - " + m).join("\n") + "\n");
  process.exit(1);
}
console.log(`Content OK: ${entries.length} entries, ${published} published, ${drafts} awaiting owner verification.`);
