// Runs the real public/sw.js in a sandbox with a fake service-worker scope and a tiny in-memory IndexedDB, then fires `push`
// and `notificationclick`, to prove the reminders glue works: what is shown, what is remembered, where a tap goes.
// Run: npx tsx scripts/check-sw-push.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const ROOT = join(import.meta.dirname, "..");
const read = (f: string) => readFileSync(join(ROOT, "public", f), "utf8");

/** Just enough IndexedDB for sw.js: open(name, v) with onupgradeneeded, one object store, get/put/clear in transactions. */
function fakeIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();
  const req = (run: () => unknown) => {
    const r: any = { result: undefined, error: null };
    queueMicrotask(() => { try { r.result = run(); r.onsuccess?.(); } catch (e) { r.error = e; r.onerror?.(); } });
    return r;
  };
  const db = {
    createObjectStore: (name: string) => { stores.set(name, new Map()); },
    transaction: (name: string) => {
      const tx: any = {
        objectStore: () => ({
          get: (k: string) => req(() => stores.get(name)!.get(k)),
          put: (v: unknown, k: string) => { stores.get(name)!.set(k, v); queueMicrotask(() => tx.oncomplete?.()); },
          clear: () => { stores.get(name)!.clear(); queueMicrotask(() => tx.oncomplete?.()); },
        }),
      };
      return tx;
    },
  };
  return {
    stores,
    open: () => {
      const r: any = { result: db };
      queueMicrotask(() => { if (!stores.has("kv")) r.onupgradeneeded?.(); r.onsuccess?.(); });
      return r;
    },
  };
}

function boot() {
  const listeners: Record<string, (e: any) => void> = {};
  const shown: { title: string; opts: any }[] = [];
  const idb = fakeIndexedDB();
  const clientsApi = { windows: [] as any[], opened: [] as string[] };
  const self: any = {
    location: { href: "https://app.test/sw.js?v=x", origin: "https://app.test" },
    addEventListener: (t: string, f: (e: any) => void) => { listeners[t] = f; },
    skipWaiting: () => {},
    registration: { showNotification: async (title: string, opts: any) => { shown.push({ title, opts }); } },
    clients: {
      matchAll: async () => clientsApi.windows,
      openWindow: async (u: string) => { clientsApi.opened.push(u); },
      claim: async () => {},
    },
  };
  const ctx: any = {
    self, indexedDB: idb, caches: { keys: async () => [], open: async () => ({}), match: async () => undefined },
    URL, Response, fetch: async () => new Response(""), console,
    importScripts: (u: string) => vm.runInContext(read(u.replace(/^\//, "")), ctx),
    Date, Promise, JSON, Object, Math, queueMicrotask,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("sw.js"), ctx);
  const fire = async (type: string, e: any = {}) => {
    const waits: Promise<unknown>[] = [];
    listeners[type]({ ...e, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  return { fire, shown, idb, clientsApi, self, listeners };
}

let groups = 0;
const run = async (name: string, fn: () => Promise<void>) => { try { await fn(); groups++; } catch (e) { console.error("FAIL", name, "\n", e); process.exitCode = 1; } };
const item = (id: string, at: number, extra: object = {}) => ({ id, at, title: `T-${id}`, body: `B-${id}`, url: `/u/${id}`, ...extra });
const seed = (b: ReturnType<typeof boot>, items: unknown[], shown: object = {}) => { b.idb.stores.set("kv", new Map<string, unknown>([["schedule", items], ["shown", shown]])); };

await run("the worker loads the reminder logic and registers push handlers", async () => {
  const b = boot();
  assert.equal(typeof b.listeners.push, "function");
  assert.equal(typeof b.listeners.notificationclick, "function");
  assert.ok(b.self.RPReminders, "reminders-sw.js was imported");
});

await run("a poke shows what is due, with its tag and tap address, and remembers it", async () => {
  const b = boot();
  const now = Date.now();
  seed(b, [item("asr", now - 5_000), item("later", now + 3_600_000)]);
  await b.fire("push");
  assert.equal(b.shown.length, 1);
  assert.equal(b.shown[0].title, "T-asr");
  assert.equal(b.shown[0].opts.body, "B-asr");
  assert.equal(b.shown[0].opts.tag, "asr");
  assert.equal(b.shown[0].opts.data.url, "/u/asr");
  assert.equal(b.shown[0].opts.renotify, false);
  const remembered = b.idb.stores.get("kv")!.get("shown") as Record<string, number>;
  assert.ok(remembered.asr > 0);
  // The same poke again replaces the same notification instead of adding another one.
  await b.fire("push");
  assert.equal(b.shown.length, 2);
  assert.equal(b.shown[1].opts.tag, "asr");
});

await run("two reminders due together are both shown", async () => {
  const b = boot();
  const now = Date.now();
  seed(b, [item("a", now - 30_000), item("b", now - 1_000)]);
  await b.fire("push");
  assert.deepEqual(b.shown.map((s) => s.opts.tag), ["a", "b"]);
});

await run("a poke with nothing due, or no schedule at all, still shows a plain notice (iOS needs one)", async () => {
  const b = boot();
  await b.fire("push"); // empty database
  assert.equal(b.shown.length, 1);
  assert.equal(b.shown[0].title, "RuqyaPro");
  assert.equal(b.shown[0].opts.data.url, "/settings#reminders-title");
  const c = boot();
  seed(c, [item("far", Date.now() + 3 * 3_600_000)]);
  await c.fire("push");
  assert.equal(c.shown[0].opts.tag, "refresh");
});

await run("a one-off that has expired is not shown", async () => {
  const b = boot();
  const now = Date.now();
  seed(b, [item("test-1", now - 60_000, { until: now - 1 })]);
  await b.fire("push");
  assert.equal(b.shown[0].opts.tag, "refresh");
});

await run("if the logic file cannot be loaded the worker still starts and still shows something", async () => {
  const listeners: Record<string, (e: any) => void> = {};
  const shown: string[] = [];
  const self: any = { location: { href: "https://app.test/sw.js", origin: "https://app.test" }, addEventListener: (t: string, f: any) => { listeners[t] = f; }, registration: { showNotification: async (t: string) => { shown.push(t); } }, clients: {} };
  const ctx: any = { self, indexedDB: fakeIndexedDB(), caches: {}, URL, Response, fetch: async () => new Response(""), importScripts: () => { throw new Error("offline"); } };
  vm.createContext(ctx);
  vm.runInContext(read("sw.js"), ctx);
  const waits: Promise<unknown>[] = [];
  listeners.push({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
  await Promise.all(waits);
  assert.deepEqual(shown, ["RuqyaPro"]);
});

await run("a tap focuses an open window and sends it to the reminder's page; otherwise opens one", async () => {
  const b = boot();
  const w = { focused: false, navigated: "", focus: async () => { w.focused = true; }, navigate: async (u: string) => { w.navigated = u; } };
  b.clientsApi.windows = [w];
  let closed = false;
  await b.fire("notificationclick", { notification: { close: () => { closed = true; }, data: { url: "/recitations?set=morning" } } });
  assert.ok(closed && w.focused);
  assert.equal(w.navigated, "https://app.test/recitations?set=morning");

  const c = boot();
  await c.fire("notificationclick", { notification: { close: () => {}, data: { url: "/quran/read?s=18" } } });
  assert.deepEqual(c.clientsApi.opened, ["https://app.test/quran/read?s=18"]);
  const d = boot();
  await d.fire("notificationclick", { notification: { close: () => {}, data: undefined } });
  assert.deepEqual(d.clientsApi.opened, ["https://app.test/"]);
});

console.log(`${groups} groups passed${process.exitCode ? ", with failures" : ""}`);
