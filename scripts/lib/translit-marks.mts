/* ---------- Consonants: Latin letters that stand for more than one Arabic letter ----------
   Tanzil's scheme writes ث ذ ظ as "th", ح ه as "h", س ص as "s", د ض as "d" and ت ط as "t". The letter a reader
   is most likely to say wrongly is the heavy one (ظ ذ, ح, ص, ض, ط), so that one is underlined.
   Nothing is guessed: letters are matched in order, word by word, and a word whose counts do not agree is left plain. */
const GROUPS: { latin: string; letters: Record<string, boolean> }[] = [
  { latin: "th", letters: { "\u062B": false, "\u0630": true, "\u0638": true } },
  { latin: "h", letters: { "\u0647": false, "\u062D": true } },
  { latin: "s", letters: { "\u0633": false, "\u0635": true } },
  { latin: "d", letters: { "\u062F": false, "\u0636": true } },
  { latin: "t", letters: { "\u062A": false, "\u0637": true } },
];
const TA_MARBUTA = "\u0629";
const SHADDA = 0x651;
const isArabicLetter = (c: string) => /[\u0621-\u064A\u0671]/.test(c);

function latinTokens(word: string) {
  const out: { t: string; start: number; end: number }[] = [];
  for (let i = 0; i < word.length; i++) {
    const two = word.slice(i, i + 2).toLowerCase();
    if (["th", "sh", "kh", "gh"].includes(two)) { out.push({ t: two, start: i, end: i + 2 }); i++; }
    else out.push({ t: word[i].toLowerCase(), start: i, end: i + 1 });
  }
  return out;
}

/* ---------- Word alignment ----------
   The Arabic words and the Latin words are lined up one for one. Tanzil writes a vocative ya as a word of its own
   ("Ya ayyuha", "ya qawmi") where the Arabic joins it to the name (يَـٰٓأَيُّهَا), so that Latin pair counts as one word. */
const VOCATIVE = /^\u064A\u064E?\u0640?\u0670/;
export interface Tok { text: string; at: number }
export function joinVocatives(aw: string[], lat: Tok[], tr: string): Tok[] | null {
  if (aw.length === lat.length) return lat;
  const out: Tok[] = [];
  let j = 0;
  for (const w of aw) {
    const t = lat[j];
    if (!t) return null;
    const n = lat[j + 1];
    if (VOCATIVE.test(w) && t.text.toLowerCase() === "ya" && n) {
      out.push({ text: tr.slice(t.at, n.at + n.text.length), at: t.at });
      j += 2;
    } else {
      out.push(t);
      j++;
    }
  }
  return j === lat.length ? out : null;
}

/** [start, end) ranges over `tr` to underline, or [] where the Arabic and the Latin do not line up word for word. */
function consonantMarks(ar: string, tr: string): [number, number][] {
  const aWords = ar.split(/\s+/).filter((w) => [...w].some(isArabicLetter));
  const raw: { text: string; at: number }[] = [];
  for (const m of tr.matchAll(/\S+/g)) raw.push({ text: m[0], at: m.index! });
  const lWords = joinVocatives(aWords, raw, tr);
  if (!lWords) return [];

  const out: [number, number][] = [];
  aWords.forEach((aw, wi) => {
    const { text, at } = lWords[wi];
    const chars = [...aw];
    const hasTaMarbuta = chars.includes(TA_MARBUTA);
    const toks = latinTokens(text);
    for (const g of GROUPS) {
      if (hasTaMarbuta && (g.latin === "h" || g.latin === "t")) continue; // the letter may be written t or h; do not guess
      // Arabic letters of this group, in order, with whether each carries a shadda (written doubled in Latin).
      const arabic: { heavy: boolean; doubled: boolean }[] = [];
      chars.forEach((c, k) => {
        if (c in g.letters) {
          let doubled = false;
          for (let j = k + 1; j < chars.length && !isArabicLetter(chars[j]); j++) if (chars[j].charCodeAt(0) === SHADDA) doubled = true;
          arabic.push({ heavy: g.letters[c], doubled });
        }
      });
      const latin = toks.filter((x) => x.t === g.latin);
      const marks: [number, number][] = [];
      let li = 0, ok = true;
      for (const a of arabic) {
        const first = latin[li++];
        if (!first) { ok = false; break; }
        let end = first.end;
        if (a.doubled) {
          const second = latin[li];
          if (!second || second.start !== first.end) { ok = false; break; }
          end = second.end; li++;
        }
        if (a.heavy) marks.push([at + first.start, at + end]);
      }
      if (ok && li === latin.length) out.push(...marks);
    }
  });
  return out.sort((a, b) => a[0] - b[0]);
}


/* ---------- Long vowels ----------
   Tanzil writes a long ā as "a" (the same letter as a short a), a long ū as "oo" and a long ī as "ee".
   The Arabic word is read as a list of vowel events (short or long), the Latin word as vowel tokens, and the two
   are matched in order. A long ā is the one written with an alif, a dagger alef, an alif maqsura, or the long ā of
   Allah; a tanween alif is marked too. A word that cannot be matched event for event is left plain. */
const CP = (c: string) => c.charCodeAt(0);
const FATHA = 0x64e, DAMMA = 0x64f, KASRA = 0x650, FATHATAN = 0x64b, DAMMATAN = 0x64c, KASRATAN = 0x64d;
const DAGGER = 0x670, MADDAH = 0x653, WASL = 0x671;
const isMarkCp = (o: number) => (o >= 0x64b && o <= 0x65f) || o === 0x670 || (o >= 0x6d6 && o <= 0x6ed);

interface VEvent { v: "a" | "i" | "u"; long: boolean; alif: boolean; wasl?: boolean; initial?: boolean; tanween?: boolean }

export function arabicEvents(word: string): VEvent[] | null {
  // units: a letter and the marks that follow it
  const units: { ch: string; marks: Set<number> }[] = [];
  for (const c of word) {
    const o = CP(c);
    if (isMarkCp(o)) { units[units.length - 1]?.marks.add(o); continue; }
    if (o === 0x6e5 || o === 0x6e6 || o === 0x200c || o === 0x200d) continue; // small waw/yaa: written as a short vowel in Latin
    if (!/[\u0621-\u064A\u0671]/.test(c)) continue;
    units.push({ ch: c, marks: new Set() });
  }
  // A tatweel that only carries a dagger alef or maddah is part of the letter before it (بَـٰ). One that carries a
  // vowel or a hamza is a seat for a hamza (سَيِّـَٔ) and counts as a letter of its own.
  for (let k = units.length - 1; k > 0; k--) {
    const u = units[k];
    if (u.ch === "\u0640" && [...u.marks].every((m) => m === DAGGER || m === MADDAH || m === 0x6e5 || m === 0x6e6 || m === 0x6e7)) {
      u.marks.forEach((m) => units[k - 1].marks.add(m));
      units.splice(k, 1);
    }
  }
  const ev: VEvent[] = [];
  const vowelOf = (m: Set<number>) => (m.has(FATHA) || m.has(FATHATAN) ? "a" : m.has(DAMMA) || m.has(DAMMATAN) ? "u" : m.has(KASRA) || m.has(KASRATAN) ? "i" : null);
  for (let k = 0; k < units.length; k++) {
    const { ch, marks } = units[k];
    const o = CP(ch);
    const prev = ev[ev.length - 1];
    const prevUnit = units[k - 1];
    const own = vowelOf(marks);
    if (o === WASL) { ev.push({ v: "a", long: false, alif: false, wasl: true, initial: k === 0 }); continue; }
    if (o === 0x622) { ev.push({ v: "a", long: true, alif: true }); continue; } // آ
    const maddLetter = o === 0x627 || o === 0x648 || o === 0x64a || o === 0x649;
    if (maddLetter && marks.has(0x6df) && o === 0x648 && !own) continue; // a silent waw (أُو۟لَـٰٓئِكَ "olaika"): written, not said
    if (maddLetter && !own && !marks.has(0x651) && !marks.has(0x652) && !marks.has(0x6e1)) {
      const pm = prevUnit?.marks ?? new Set<number>();
      if ((o === 0x627 || o === 0x649) && prev && (pm.has(FATHA) || pm.has(FATHATAN))) {
        if (pm.has(FATHATAN)) prev.tanween = true; // said long only when the verse stops here
        else { prev.long = true; prev.alif = true; }
        continue;
      }
      if (o === 0x648 && prev && prev.v === "u" && (pm.has(DAMMA))) { prev.long = true; continue; }
      if ((o === 0x64a || o === 0x649) && prev && prev.v === "i" && pm.has(KASRA)) { prev.long = true; continue; }
      continue; // silent alif, or the consonant half of aw / ay
    }
    if (marks.has(DAGGER)) { ev.push({ v: "a", long: true, alif: true }); continue; }
    if (own) {
      const e: VEvent = { v: own, long: (own === "u" && (marks.has(0x6e5) || (o === 0x648 && units[k + 1]?.ch === "\u0627" && units[k + 1].marks.has(0x6df)))) || (own === "i" && (marks.has(0x6e6) || marks.has(0x6e7))), alif: false };
      // The long ā of Allah: a lam with shadda and fatha before ه.
      if (o === 0x644 && marks.has(0x651) && own === "a" && units[k + 1]?.ch === "ه") { e.long = true; e.alif = true; }
      ev.push(e);
    }
  }
  return ev;
}

interface VTok { ch: string; start: number; end: number; run: number }
export function latinVowelChars(word: string): { c: string; i: number; run: number }[] {
  const out: { c: string; i: number; run: number }[] = [];
  let run = -1, inRun = false;
  for (let i = 0; i < word.length; i++) {
    if (word[i] === "A" && word[i + 1] === "A") { inRun = false; i++; continue; } // AA is the letter ayn
    if (/[aeiouAEIOU]/.test(word[i])) {
      if (!inRun) { run++; inRun = true; }
      out.push({ c: word[i].toLowerCase(), i, run });
    } else inRun = false;
  }
  return out;
}

/** Match events to Latin vowel characters in order. Returns the character ranges of each event, or null. */
export function matchVowels(ev: VEvent[], chars: { c: string; i: number; run: number }[]): { start: number; end: number }[] | null {
  const memo = new Map<string, { start: number; end: number }[] | null>();
  const go = (ei: number, ci: number): { start: number; end: number }[] | null => {
    if (ei === ev.length) return ci === chars.length ? [] : null;
    const key = ei + ":" + ci;
    if (memo.has(key)) return memo.get(key)!;
    let res: { start: number; end: number }[] | null = null;
    const e = ev[ei];
    const here = chars[ci];
    if (!here) { memo.set(key, null); return null; }
    // Spellings: short a / i / u; long ā "a" or "aa", long ī "i" or "ee", long ū "u" or "oo".
    // A hamzat wasl takes whatever vowel starts the word when it is said alone (ittaqoo, othkur, onthur). Tanzil also writes a
    // short u as "o" (olaika, okhra, yashao, shayon).
    const forms: string[] = e.wasl ? ["a", "i", "u", "o"] : e.long ? (e.v === "a" ? ["aa", "a"] : e.v === "i" ? ["ee", "i"] : ["oo", "u"]) : e.v === "u" ? ["u", "o"] : [e.v];
    for (const f of forms) {
      let ok = true;
      for (let q = 0; q < f.length; q++) {
        const ch = chars[ci + q];
        if (!ch || ch.c !== f[q] || ch.run !== here.run || ch.i !== here.i + q) { ok = false; break; }
      }
      if (!ok) continue;
      const rest = go(ei + 1, ci + f.length);
      if (rest) { res = [{ start: here.i, end: here.i + f.length }, ...rest]; break; }
    }
    // Tanzil also writes a long ū / ī with an "o" / "e": not used in its scheme, so no other spellings are tried.
    memo.set(key, res);
    return res;
  };
  return go(0, 0);
}

function vowelMarks(ar: string, tr: string): [number, number][] {
  const aWords = ar.split(/\s+/).filter((w) => [...w].some((c) => /[ء-يٱ]/.test(c)));
  const raw: { text: string; at: number }[] = [];
  for (const m of tr.matchAll(/\S+/g)) raw.push({ text: m[0], at: m.index! });
  const lWords = joinVocatives(aWords, raw, tr);
  if (!lWords) return [];
  const out: [number, number][] = [];
  aWords.forEach((aw, wi) => {
    const { text, at } = lWords[wi];
    const ev = arabicEvents(aw);
    if (!ev || !ev.length) return;
    const hit = matchVowels(ev, latinVowelChars(text));
    if (!hit) return;
    ev.forEach((e, k) => {
      const stops = wi === aWords.length - 1 && k === ev.length - 1 && e.tanween;
      if (e.alif || stops) out.push([at + hit[k].start, at + hit[k].end]);
    });
  });
  return out;
}

/** [start, end) ranges over `tr` to underline: heavy-letter consonants and long vowels. Words that cannot be matched are left plain. */
export function underlineTranslit(ar: string, tr: string): [number, number][] {
  const all = [...consonantMarks(ar, tr), ...vowelMarks(ar, tr)].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  // Merge touching or overlapping ranges so the underline runs unbroken.
  const merged: [number, number][] = [];
  for (const r of all) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}


/* ---------- Silent letters ----------
   Two kinds, both from the Arabic text itself: the hamzat wasl (the alif of "al-", "ibn" and so on), which is not said
   when the word is joined to the one before it, and the lam of "al-" before a sun letter, which is never said (as-samawati).
   The first word of a verse, and a word after a waqf sign, is said from its alif, so it is left plain. */
const SUN = new Set(["ت", "ث", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ن"]);
const WAQF = /[ۖ-ۜ]/;

function silentLamAt(aw: string): boolean {
  const chars = [...aw];
  let k = chars.findIndex((c) => c === "ٱ");
  if (k < 0) return false;
  // ٱ then a bare ل (no vowel, no sukun) then a sun letter that carries a shadda
  let j = k + 1;
  while (j < chars.length && isMarkCp(CP(chars[j]))) j++;
  if (chars[j] !== "ل") return false;
  let m = j + 1, bare = true;
  while (m < chars.length && isMarkCp(CP(chars[m]))) { if (CP(chars[m]) !== 0x640) bare = false; m++; }
  if (!bare || !SUN.has(chars[m])) return false;
  let n = m + 1, shadda = false;
  while (n < chars.length && isMarkCp(CP(chars[n]))) { if (CP(chars[n]) === SHADDA) shadda = true; n++; }
  return shadda;
}

/** [start, end) ranges over `tr` that are not said. Words that cannot be matched are left plain. */
export function silentTranslit(ar: string, tr: string): [number, number][] {
  const raw = ar.split(/\s+/).filter(Boolean);
  const words: { text: string; connected: boolean }[] = [];
  let stop = true;
  for (const tok of raw) {
    if ([...tok].some((c) => /[ء-يٱ]/.test(c))) {
      words.push({ text: tok, connected: !stop });
      stop = WAQF.test(tok);
    } else stop = true; // a waqf sign standing alone
  }
  const latRaw: { text: string; at: number }[] = [];
  for (const m of tr.matchAll(/\S+/g)) latRaw.push({ text: m[0], at: m.index! });
  const lWords = joinVocatives(words.map((w) => w.text), latRaw, tr);
  if (!lWords) return [];

  const out: [number, number][] = [];
  words.forEach((w, wi) => {
    const { text, at } = lWords[wi];
    const ev = arabicEvents(w.text);
    if (ev?.length) {
      const hit = matchVowels(ev, latinVowelChars(text));
      if (hit) {
        ev.forEach((e, k) => { if (e.wasl && (!e.initial || w.connected)) out.push([at + hit[k].start, at + hit[k].end]); });
        // A verse that ends on a tanween alif is said "...an" as a long ā with the n dropped (nukra): the n is not said.
        const k = ev.length - 1;
        if (wi === words.length - 1 && ev[k].tanween && hit[k].end === text.length - 1 && text[hit[k].end].toLowerCase() === "n") out.push([at + hit[k].end, at + hit[k].end + 1]);
      }
    }
    if (silentLamAt(w.text)) {
      // the Latin "l" that sits right before a doubled letter ("al" + "ss")
      const toks = latinTokens(text);
      const cand = toks.filter((t, i) => t.t === "l" && toks[i + 1] && toks[i + 2] && toks[i + 1].t === toks[i + 2].t && toks[i + 1].start === t.end);
      if (cand.length === 1) out.push([at + cand[0].start, at + cand[0].end]);
    }
  });
  return out.sort((a, b) => a[0] - b[0]);
}
