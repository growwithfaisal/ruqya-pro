// Checks how a reader's progress is merged between devices (src/lib/account-merge.ts).
// Run: npx tsx scripts/check-account-merge.mts
import assert from "node:assert/strict";
import {
  DONE_KEEP_DAYS, KEYS, SETTING_KEYS, adoptSettings, canonical, cutoffFor, mergeSet, merge, parseSnapshot, readLocal, readSettings, reconcile, writeLocal,
  type Snapshot, type Store,
} from "../src/lib/account-merge";

let groups = 0, bad = 0;
const ok = (name: string, fn: () => void) => { try { fn(); groups++; } catch (e) { bad++; console.error("FAIL", name, "\n", e); } };

class Fake implements Store {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const TODAY = "2026-10-02";
const CUT = cutoffFor(TODAY);
const empty = (): Snapshot => ({ v: 1, days: [], marks: [], seen: null, last: null, done: {} });

ok("cutoff is 14 days back", () => {
  assert.equal(DONE_KEEP_DAYS, 14);
  assert.equal(CUT, "2026-09-18");
  assert.equal(cutoffFor("2026-03-08"), "2026-02-22");
});

ok("lists merge three ways: adds from both sides survive, removals on either side stick", () => {
  assert.deepEqual(mergeSet(["a", "b"], ["a", "c"], ["a"]), ["a", "b", "c"]); // b added here, c added there
  assert.deepEqual(mergeSet(["a"], ["a", "b"], ["a", "b"]), ["a"]); // removed here, still there: stays removed
  assert.deepEqual(mergeSet(["a", "b"], ["a"], ["a", "b"]), ["a"]); // removed there, still here: stays removed
  assert.deepEqual(mergeSet([], [], ["a", "b"]), []); // removed on both
  assert.deepEqual(mergeSet(["a", "x"], ["a"], ["a", "b"]), ["a", "x"]); // here added x; there removed b (here had already lost b)
  assert.deepEqual(mergeSet(["a", "b"], ["b", "c"], null), ["a", "b", "c"]); // no base (first sync): union, this device's order first
  assert.deepEqual(mergeSet(["a", "a"], ["a"], null), ["a"]);
  assert.deepEqual(mergeSet(["a", "b"], ["a", "b"], ["a", "b"]), ["a", "b"]);
});

ok("a deleted bookmark does not come back; a new one on the other device arrives", () => {
  const base: Snapshot = { ...empty(), marks: ["2:255", "1:1"] };
  const phone: Snapshot = { ...empty(), marks: ["1:1"] }; // deleted 2:255
  const laptop: Snapshot = { ...empty(), marks: ["2:255", "1:1", "18:10"] }; // added 18:10
  assert.deepEqual(merge(phone, laptop, base, CUT).marks, ["1:1", "18:10"]);
  const other = merge(laptop, phone, base, CUT).marks; // the same merge seen from the laptop
  assert.deepEqual([...other].sort(), ["1:1", "18:10"].sort());
  assert.ok(!other.includes("2:255"));
});

ok("reading days only grow, and stay sorted", () => {
  const a: Snapshot = { ...empty(), days: ["2026-10-02", "2026-10-01"] };
  const b: Snapshot = { ...empty(), days: ["2026-09-30", "2026-10-01"] };
  assert.deepEqual(merge(a, b, null, CUT).days, ["2026-09-30", "2026-10-01", "2026-10-02"]);
});

ok("routine ticks merge per day, un-ticking sticks, and days past the cutoff are dropped", () => {
  const base: Snapshot = { ...empty(), done: { "2026-10-02": ["morning:dua-1", "morning:dua-2"] } };
  const phone: Snapshot = { ...empty(), done: { "2026-10-02": ["morning:dua-1"] } }; // un-ticked dua-2
  const laptop: Snapshot = { ...empty(), done: { "2026-10-02": ["morning:dua-1", "morning:dua-2", "evening:dua-9"], "2026-09-01": ["morning:old"] } };
  const m = merge(phone, laptop, base, CUT);
  assert.deepEqual(m.done, { "2026-10-02": ["morning:dua-1", "evening:dua-9"] });
  assert.equal((m.done as Record<string, string[]>)["2026-09-01"], undefined);
});

ok("'seen today' follows its day; 'last read' follows the later time", () => {
  const old = { date: "2026-10-01", keys: ["1:1"] }, today = { date: "2026-10-02", keys: ["2:1"] }, today2 = { date: "2026-10-02", keys: ["2:2"] };
  assert.deepEqual(merge({ ...empty(), seen: old }, { ...empty(), seen: today }, null, CUT).seen, today);
  assert.deepEqual(merge({ ...empty(), seen: today }, { ...empty(), seen: old }, null, CUT).seen, today);
  assert.deepEqual(merge({ ...empty(), seen: today }, { ...empty(), seen: today2 }, null, CUT).seen, { date: "2026-10-02", keys: ["2:1", "2:2"] });
  const a = { surah: 2, verse: 10, at: 100 }, b = { surah: 18, verse: 3, at: 200 };
  assert.deepEqual(merge({ ...empty(), last: a }, { ...empty(), last: b }, null, CUT).last, b);
  assert.deepEqual(merge({ ...empty(), last: b }, { ...empty(), last: a }, null, CUT).last, b);
  assert.deepEqual(merge({ ...empty(), last: null }, { ...empty(), last: a }, null, CUT).last, a);
});

ok("canonical ignores order and settings, and sees real differences", () => {
  const a: Snapshot = { ...empty(), days: ["2026-10-01", "2026-10-02"], marks: ["a", "b"], done: { "2026-10-02": ["x", "y"] } };
  const b: Snapshot = { ...empty(), days: ["2026-10-02", "2026-10-01"], marks: ["b", "a"], done: { "2026-10-02": ["y", "x"] }, settings: { "rp:arabic": "1.2" } };
  assert.equal(canonical(a), canonical(b));
  assert.notEqual(canonical(a), canonical({ ...a, marks: ["a"] }));
  assert.notEqual(canonical(a), canonical({ ...a, last: { surah: 1, verse: 1, at: 5 } }));
});

ok("storage round trip: reads tolerant, writes only what changed", () => {
  const s = new Fake();
  s.setItem(KEYS.days, JSON.stringify(["2026-10-01", "junk", 5]));
  s.setItem(KEYS.marks, "not json");
  s.setItem(KEYS.last, JSON.stringify({ surah: 2, verse: 255, at: 10 }));
  s.setItem(KEYS.donePrefix + "2026-10-02", JSON.stringify(["morning:a"]));
  s.setItem(KEYS.donePrefix + "2026-01-01", JSON.stringify(["old"]));
  s.setItem("rp:v1:prayer:place", JSON.stringify({ lat: 1, lon: 2 }));
  const snap = readLocal(s, CUT);
  assert.deepEqual(snap.days, ["2026-10-01"]);
  assert.deepEqual(snap.marks, []);
  assert.deepEqual(snap.done, { "2026-10-02": ["morning:a"] });
  assert.equal(snap.last?.verse, 255);
  const merged = { ...snap, marks: ["2:1"], done: { "2026-10-02": ["morning:a", "morning:b"] } };
  assert.equal(writeLocal(s, merged, snap), true);
  assert.deepEqual(JSON.parse(s.getItem(KEYS.marks)!), ["2:1"]);
  assert.deepEqual(JSON.parse(s.getItem(KEYS.donePrefix + "2026-10-02")!), ["morning:a", "morning:b"]);
  assert.equal(s.getItem(KEYS.donePrefix + "2026-01-01"), JSON.stringify(["old"]), "old days are left alone");
  assert.equal(writeLocal(s, merged, readLocal(s, CUT)), false, "nothing to write the second time");
});

ok("parseSnapshot is careful with what the server sends", () => {
  assert.equal(parseSnapshot(null), null);
  assert.equal(parseSnapshot("nope"), null);
  assert.equal(parseSnapshot('"string"'), null);
  const p = parseSnapshot(JSON.stringify({ days: ["2026-10-01", "x"], marks: ["1:1", 3], done: { "bad": ["a"], "2026-10-02": ["m:a"] }, settings: { "rp:arabic": "1.1", "rp:v1:prayer:place": "NOPE" } }))!;
  assert.deepEqual([p.days, p.marks, p.done], [["2026-10-01"], ["1:1"], { "2026-10-02": ["m:a"] }]);
  assert.deepEqual(p.settings, { "rp:arabic": "1.1" }, "the saved location can never arrive through sync");
});

ok("settings: adopted from the account only on joining; the location is never touched", () => {
  const s = new Fake();
  s.setItem("rp:v1:prayer:place", "MINE");
  s.setItem("rp:arabic", "1.0");
  assert.equal(adoptSettings(s, { "rp:arabic": "1.4", "rp:v1:night": "1" }), true);
  assert.deepEqual(readSettings(s), { "rp:arabic": "1.4", "rp:v1:night": "1" });
  assert.equal(s.getItem("rp:v1:prayer:place"), "MINE");
  assert.equal(adoptSettings(s, { "rp:arabic": "1.4" }), false);
  assert.ok(SETTING_KEYS.every((k) => !k.includes("place")));
});

/* ---- two devices and a server, going through whole rounds ---- */
function world() {
  const server = { text: null as string | null };
  const dev = (name: string) => ({ name, store: new Fake(), base: null as Snapshot | null, joined: false });
  const sync = (d: ReturnType<typeof dev>) => {
    const r = reconcile(d.store, server.text, d.base, { cutoff: CUT, join: !d.joined });
    if (r.upload) server.text = r.upload;
    d.base = r.merged;
    d.joined = true;
    return r;
  };
  return { server, dev, sync };
}
const marks = (d: { store: Fake }) => JSON.parse(d.store.getItem(KEYS.marks) ?? "[]") as string[];

ok("phone and laptop: progress travels both ways and a second sync with nothing new sends nothing", () => {
  const w = world();
  const phone = w.dev("phone"), laptop = w.dev("laptop");
  phone.store.setItem(KEYS.days, JSON.stringify(["2026-10-01"]));
  phone.store.setItem(KEYS.marks, JSON.stringify(["2:255"]));
  phone.store.setItem("rp:arabic", "1.3");
  assert.ok(w.sync(phone).upload, "first device uploads");
  const r = w.sync(laptop);
  assert.equal(r.changedLocal, true);
  assert.deepEqual(marks(laptop), ["2:255"]);
  assert.equal(laptop.store.getItem("rp:arabic"), "1.3", "settings adopted on joining");
  assert.equal(r.upload, null, "the laptop had nothing to add");
  assert.equal(w.sync(phone).upload, null);
  assert.equal(w.sync(laptop).upload, null);
});

ok("delete on one device, add on the other, in either order: nothing is resurrected, nothing is lost", () => {
  const w = world();
  const phone = w.dev("phone"), laptop = w.dev("laptop");
  phone.store.setItem(KEYS.marks, JSON.stringify(["2:255", "1:1"]));
  w.sync(phone); w.sync(laptop);
  // both change while apart
  phone.store.setItem(KEYS.marks, JSON.stringify(["1:1"])); // phone deletes 2:255
  laptop.store.setItem(KEYS.marks, JSON.stringify(["2:255", "1:1", "18:10"])); // laptop adds 18:10
  w.sync(phone);
  w.sync(laptop);
  w.sync(phone);
  assert.deepEqual([...marks(phone)].sort(), ["1:1", "18:10"].sort());
  assert.deepEqual([...marks(laptop)].sort(), ["1:1", "18:10"].sort());
});

ok("a new device with its own history merges rather than overwrites", () => {
  const w = world();
  const phone = w.dev("phone"), laptop = w.dev("laptop");
  phone.store.setItem(KEYS.days, JSON.stringify(["2026-09-30", "2026-10-01"]));
  laptop.store.setItem(KEYS.days, JSON.stringify(["2026-10-02"])); // used the laptop before making an account
  laptop.store.setItem(KEYS.marks, JSON.stringify(["36:1"]));
  w.sync(phone);
  w.sync(laptop);
  w.sync(phone);
  const days = (d: { store: Fake }) => JSON.parse(d.store.getItem(KEYS.days)!) as string[];
  assert.deepEqual(days(phone), ["2026-09-30", "2026-10-01", "2026-10-02"]);
  assert.deepEqual(days(laptop), days(phone));
  assert.deepEqual(marks(phone), ["36:1"]);
});

ok("a wiped browser signs back in and gets everything", () => {
  const w = world();
  const laptop = w.dev("laptop");
  laptop.store.setItem(KEYS.days, JSON.stringify(["2026-10-01"]));
  laptop.store.setItem(KEYS.marks, JSON.stringify(["2:255"]));
  laptop.store.setItem(KEYS.last, JSON.stringify({ surah: 2, verse: 255, at: 9 }));
  w.sync(laptop);
  const again = w.dev("laptop-after-safari-cleared-it"); // empty storage, no base, not joined
  w.sync(again);
  assert.deepEqual(marks(again), ["2:255"]);
  assert.equal(JSON.parse(again.store.getItem(KEYS.last)!).verse, 255);
  assert.equal(w.server.text !== null && parseSnapshot(w.server.text)!.marks.length, 1, "the server copy was not wiped by the empty device");
});

ok("routine ticks sync, and only recent days travel", () => {
  const w = world();
  const phone = w.dev("phone"), laptop = w.dev("laptop");
  phone.store.setItem(KEYS.donePrefix + "2026-10-02", JSON.stringify(["morning:a"]));
  phone.store.setItem(KEYS.donePrefix + "2026-05-01", JSON.stringify(["morning:ancient"]));
  w.sync(phone); w.sync(laptop);
  assert.deepEqual(JSON.parse(laptop.store.getItem(KEYS.donePrefix + "2026-10-02")!), ["morning:a"]);
  assert.equal(laptop.store.getItem(KEYS.donePrefix + "2026-05-01"), null);
  assert.ok(!w.server.text!.includes("ancient"));
});

console.log(`${groups} groups passed${bad ? `, ${bad} FAILED` : ""}`);
process.exit(bad ? 1 : 0);
