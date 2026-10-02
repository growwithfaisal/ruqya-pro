// End-to-end check of the reminders Worker running locally under `wrangler dev` (real workerd, local D1) against a mock push service.
// Run: npx tsx test/e2e.mts      (from reminders-worker/; first run needs `npm install`)
import assert from "node:assert/strict";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { publicKeyOf, type VapidJwk } from "../src/lib.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const state = mkdtempSync(join(tmpdir(), "rp-worker-"));
const MOCK = 8799, API = 8788;
const base = `http://127.0.0.1:${API}`;
const FLAGS = ["--local", "--persist-to", state];

/* ---- a mock push service ---- */
interface Seen { path: string; headers: Record<string, string | string[] | undefined>; bytes: number }
const seen: Seen[] = [];
const hits = new Map<string, number>();
const mock = createServer((req, res) => {
  let bytes = 0;
  req.on("data", (c) => (bytes += c.length));
  req.on("end", () => {
    seen.push({ path: req.url!, headers: req.headers, bytes });
    const n = (hits.get(req.url!) ?? 0) + 1;
    hits.set(req.url!, n);
    const p = req.url!;
    // /flip: accepted once, then "gone".  /err: accepted once, then a server error.  /reject: never accepted.
    const status = p.startsWith("/reject") ? 404 : p.startsWith("/flip") ? (n === 1 ? 201 : 410) : p.startsWith("/err") ? (n === 1 ? 201 : 503) : 201;
    res.writeHead(status).end();
  });
});
await new Promise<void>((r) => mock.listen(MOCK, "127.0.0.1", r));

/* ---- the Worker ---- */
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const j = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as VapidJwk;
const jwk: VapidJwk = { kty: j.kty, crv: j.crv, x: j.x, y: j.y, d: j.d };
writeFileSync(join(root, ".dev.vars"), `VAPID_PRIVATE_JWK='${JSON.stringify(jwk)}'\nEXTRA_ORIGINS=http://127.0.0.1:${MOCK}\nSYNC_GAP_SECONDS=0\n`);

const wrangler = (...a: string[]) => execFileSync("npx", ["wrangler", ...a], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
wrangler("d1", "migrations", "apply", "ruqyapro-reminders", ...FLAGS);
const sql = (q: string) => (JSON.parse(wrangler("d1", "execute", "ruqyapro-reminders", ...FLAGS, "--json", "--command", q)) as { results: any[] }[])[0].results;

let dev: ChildProcess | undefined;
const stop = () => { dev?.kill("SIGTERM"); mock.close(); rmSync(state, { recursive: true, force: true }); rmSync(join(root, ".dev.vars"), { force: true }); };
process.on("exit", stop);
dev = spawn("npx", ["wrangler", "dev", ...FLAGS, "--test-scheduled", "--port", String(API), "--ip", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
dev.stdout!.on("data", (d) => (log += d));
dev.stderr!.on("data", (d) => (log += d));
for (let i = 0; ; i++) {
  try { if ((await fetch(`${base}/v1/health`)).ok) break; } catch {}
  if (i > 120) { console.error(log); throw new Error("The Worker did not start"); }
  await new Promise((r) => setTimeout(r, 500));
}

/* ---- helpers ---- */
let checks = 0;
const step = async (name: string, fn: () => Promise<void>) => {
  try { await fn(); checks++; } catch (e) { console.error("FAIL", name, "\n", e); console.error(log.split("\n").slice(-15).join("\n")); stop(); process.exit(1); }
};
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: (await r.json().catch(() => null)) as any, headers: r.headers }));
const cron = () => fetch(`${base}/__scheduled?cron=*+*+*+*+*`).then(() => new Promise((r) => setTimeout(r, 700)));
const now = Math.floor(Date.now() / 1000 / 60) * 60;
const ep = (kind: string, id: string) => `http://127.0.0.1:${MOCK}/${kind}/${id}-padding-padding`;
const pokesTo = (e: string) => seen.filter((s) => s.path === new URL(e).pathname).length;

await step("browsers from other sites are refused", async () => {
  const bad = await fetch(`${base}/v1/sync`, { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
  assert.equal(bad.status, 403);
  const good = await fetch(`${base}/v1/sync`, { method: "OPTIONS", headers: { Origin: "https://ruqya-pro11.vercel.app" } });
  assert.equal(good.status, 204);
  assert.equal(good.headers.get("access-control-allow-origin"), "https://ruqya-pro11.vercel.app");
});

await step("an address that is not a push service is refused", async () => {
  const r = await post("/v1/sync", { endpoint: "https://evil.example.com/abcdefghijklmnopqrstuvwxyz", times: [now + 60] });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "endpoint");
});

const A = ep("ok", "alpha");
let tokenA = "";
await step("a new phone is checked with a real poke, then kept; the poke is empty and signed", async () => {
  const r = await post("/v1/sync", { endpoint: A, times: [now, now + 3600, now + 86400] });
  assert.equal(r.status, 200);
  assert.ok(r.body.token.length >= 30);
  tokenA = r.body.token;
  assert.equal(pokesTo(A), 1);
  const s = seen.find((x) => x.path === new URL(A).pathname)!;
  assert.equal(s.bytes, 0, "the poke must have no body");
  const auth = String(s.headers.authorization);
  assert.match(auth, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
  assert.ok(auth.endsWith(`k=${publicKeyOf(jwk)}`));
  assert.equal(s.headers.ttl, "600");
  assert.equal(s.headers.urgency, "high");
  const row = sql("SELECT times, next_at FROM subs")[0];
  assert.equal(row.next_at, now);
  assert.equal(JSON.parse(row.times).length, 3);
  assert.equal(sql("SELECT n FROM meta WHERE k='subs'")[0].n, 1);
});

await step("only the phone with the token may change its schedule", async () => {
  assert.equal((await post("/v1/sync", { endpoint: A, times: [now + 60] })).status, 401);
  assert.equal((await post("/v1/sync", { endpoint: A, times: [now + 60], token: "x".repeat(32) })).status, 401);
  const ok = await post("/v1/sync", { endpoint: A, times: [now, now + 3600, now + 86400], token: tokenA });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.token, undefined);
});

await step("the minute run pokes what is due, once, and moves on", async () => {
  const before = pokesTo(A);
  await cron();
  assert.equal(pokesTo(A), before + 1);
  const row = sql("SELECT times, next_at FROM subs WHERE endpoint LIKE '%alpha%'")[0];
  assert.deepEqual(JSON.parse(row.times), [now + 3600, now + 86400]);
  assert.equal(row.next_at, now + 3600);
  await cron();
  assert.equal(pokesTo(A), before + 1, "nothing more is due, so no more pokes");
});

await step("a push service that says 'gone' removes the phone", async () => {
  const F = ep("flip", "bravo");
  const r = await post("/v1/sync", { endpoint: F, times: [now + 60] });
  assert.equal(r.status, 200);
  assert.equal((await post("/v1/sync", { endpoint: F, times: [now], token: r.body.token })).status, 200);
  await cron();
  assert.equal(sql("SELECT COUNT(*) AS c FROM subs WHERE endpoint LIKE '%bravo%'")[0].c, 0);
  assert.equal(sql("SELECT n FROM meta WHERE k='subs'")[0].n, 1);
});

await step("a push service that errors is retried, not dropped", async () => {
  const E = ep("err", "charlie");
  const r = await post("/v1/sync", { endpoint: E, times: [now + 60] });
  assert.equal((await post("/v1/sync", { endpoint: E, times: [now, now + 7200], token: r.body.token })).status, 200);
  await cron();
  await cron();
  assert.ok(pokesTo(E) >= 3, `expected retries, saw ${pokesTo(E)}`);
  const row = sql("SELECT times, next_at FROM subs WHERE endpoint LIKE '%charlie%'")[0];
  assert.equal(row.next_at, now, "the due time is kept for the next retry");
});

await step("an address the push service rejects is never kept", async () => {
  const R = ep("reject", "delta");
  const r = await post("/v1/sync", { endpoint: R, times: [now + 60] });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "rejected");
  assert.equal(sql("SELECT COUNT(*) AS c FROM subs WHERE endpoint LIKE '%delta%'")[0].c, 0);
});

await step("test pokes are limited, and forgetting needs the token", async () => {
  assert.equal((await post("/v1/test", { endpoint: A, token: tokenA })).status, 429, "created moments ago, so the 5-minute limit applies");
  assert.equal((await post("/v1/forget", { endpoint: A, token: "y".repeat(32) })).status, 401);
  assert.equal((await post("/v1/forget", { endpoint: A, token: tokenA })).status, 200);
  assert.equal(sql("SELECT COUNT(*) AS c FROM subs WHERE endpoint LIKE '%alpha%'")[0].c, 0);
});

await step("an empty schedule removes the phone", async () => {
  const Z = ep("ok", "echo");
  const r = await post("/v1/sync", { endpoint: Z, times: [now + 60] });
  assert.equal(r.status, 200);
  const gone = await post("/v1/sync", { endpoint: Z, times: [], token: r.body.token });
  assert.equal(gone.status, 200);
  assert.equal(sql("SELECT COUNT(*) AS c FROM subs WHERE endpoint LIKE '%echo%'")[0].c, 0);
});

console.log(`${checks} end-to-end groups passed`);
stop();
process.exit(0);
