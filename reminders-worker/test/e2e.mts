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
const CODE = "pilot-code-for-tests";
const DATA_KEY = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
writeFileSync(join(root, ".dev.vars"), `VAPID_PRIVATE_JWK='${JSON.stringify(jwk)}'\nEXTRA_ORIGINS=http://127.0.0.1:${MOCK}\nSYNC_GAP_SECONDS=0\nSIGNUP_CODE=${CODE}\nDATA_KEY=${DATA_KEY}\nMAX_ACCOUNTS=3\n`);

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
const cron = () => fetch(`${base}/__scheduled?cron=*+*+*+*+*`).then(() => new Promise((r) => setTimeout(r, 1500)));
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
  for (let i = 0; i < 20 && pokesTo(E) < 3; i++) await new Promise((r) => setTimeout(r, 250)); // the run finishes in the background
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

/* ---------------- accounts ---------------- */

const call = (method: string, path: string, body?: unknown, token?: string, origin?: string) =>
  fetch(base + path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, body: (await r.json().catch(() => null)) as any, headers: r.headers }));
const AUTH = "Q".repeat(43), WRONG = "R".repeat(43);

let t1 = "", t2 = "";
await step("browsers may send the sign-in header and use PUT and DELETE", async () => {
  const r = await fetch(`${base}/v1/data`, { method: "OPTIONS", headers: { Origin: "https://ruqya-pro11.vercel.app" } });
  assert.equal(r.status, 204);
  assert.match(r.headers.get("access-control-allow-headers")!, /authorization/);
  assert.match(r.headers.get("access-control-allow-methods")!, /PUT/);
  assert.match(r.headers.get("access-control-allow-methods")!, /DELETE/);
});

await step("creating an account needs the invite code, a sane name and a derived password", async () => {
  assert.equal((await call("POST", "/v1/account/signup", { username: "ayesha", auth: AUTH })).body.error, "code");
  assert.equal((await call("POST", "/v1/account/signup", { username: "ayesha", auth: AUTH, code: "wrong" })).status, 403);
  assert.equal((await call("POST", "/v1/account/signup", { username: "a b", auth: AUTH, code: CODE })).body.error, "username");
  assert.equal((await call("POST", "/v1/account/signup", { username: "ayesha", auth: "short", code: CODE })).body.error, "auth");
  assert.equal(sql("SELECT COUNT(*) AS c FROM accounts")[0].c, 0);
});

await step("a good sign-up works, names are not case-sensitive, and only a salted hash is stored", async () => {
  const r = await call("POST", "/v1/account/signup", { username: "Ayesha", auth: AUTH, code: CODE });
  assert.equal(r.status, 201);
  assert.equal(r.body.username, "ayesha");
  t1 = r.body.token;
  assert.ok(t1.length >= 30);
  const again = await call("POST", "/v1/account/signup", { username: "AYESHA", auth: WRONG, code: CODE });
  assert.equal(again.status, 409);
  assert.equal(again.body.error, "taken");
  const row = sql("SELECT username, salt, auth_hash FROM accounts")[0];
  assert.equal(row.username, "ayesha");
  assert.match(row.auth_hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(row).includes(AUTH), "the derived password is not stored");
  assert.equal(sql("SELECT n FROM meta WHERE k='accounts'")[0].n, 1);
  assert.equal(sql("SELECT COUNT(*) AS c FROM sessions")[0].c, 1);
});

await step("signing in: right password works; wrong password and unknown name give the same answer", async () => {
  const wrong = await call("POST", "/v1/account/login", { username: "ayesha", auth: WRONG });
  const nobody = await call("POST", "/v1/account/login", { username: "nobody", auth: WRONG });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, nobody.body);
  assert.equal(nobody.status, 401);
  const ok = await call("POST", "/v1/account/login", { username: "AYESHA", auth: AUTH });
  assert.equal(ok.status, 200);
  t2 = ok.body.token;
  assert.notEqual(t2, t1);
});

await step("five wrong tries lock the account, even against the right password, until the time passes", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await call("POST", "/v1/account/login", { username: "ayesha", auth: WRONG })).status, 401);
  const locked = await call("POST", "/v1/account/login", { username: "ayesha", auth: AUTH });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.error, "locked");
  assert.ok(locked.body.retryAfter > 800 && locked.body.retryAfter <= 900);
  wrangler("d1", "execute", "ruqyapro-reminders", ...FLAGS, "--command", "UPDATE accounts SET locked_until = 0");
  assert.equal((await call("POST", "/v1/account/login", { username: "ayesha", auth: AUTH })).status, 200);
});

await step("progress: needs a session, starts empty, and is saved only against the revision the phone last saw", async () => {
  assert.equal((await call("GET", "/v1/data")).status, 401);
  assert.equal((await call("GET", "/v1/data", undefined, "x".repeat(40))).status, 401);
  const empty = await call("GET", "/v1/data", undefined, t1);
  assert.deepEqual([empty.status, empty.body.rev, empty.body.data], [200, 0, null]);

  const first = JSON.stringify({ v: 1, marks: ["2:255"], secret: "READABLE-MARKER" });
  const put1 = await call("PUT", "/v1/data", { baseRev: 0, data: first }, t1);
  assert.deepEqual([put1.status, put1.body.rev], [200, 1]);
  const got = await call("GET", "/v1/data", undefined, t2); // a second device
  assert.deepEqual([got.body.rev, got.body.data], [1, first]);
  const stored = sql("SELECT data FROM accounts")[0].data as string;
  assert.ok(stored && !stored.includes("READABLE-MARKER") && !stored.includes("2:255"), "stored sealed, not readable");

  const stale = await call("PUT", "/v1/data", { baseRev: 0, data: JSON.stringify({ v: 1, other: true }) }, t2);
  assert.equal(stale.status, 409);
  assert.deepEqual([stale.body.rev, stale.body.data], [1, first], "a stale save is refused and the phone is handed the current copy");

  const next = JSON.stringify({ v: 1, marks: ["2:255", "1:1"] });
  const put2 = await call("PUT", "/v1/data", { baseRev: 1, data: next }, t2);
  assert.deepEqual([put2.status, put2.body.rev], [200, 2]);
  assert.equal((await call("PUT", "/v1/data", { baseRev: 2, data: "not json" }, t1)).body.error, "data");
  assert.equal((await call("PUT", "/v1/data", { baseRev: 2, data: JSON.stringify({ pad: "x".repeat(310_000) }) }, t1)).status, 400);
  assert.equal((await call("PUT", "/v1/data", { baseRev: -1, data: "{}" }, t1)).status, 400);
});

await step("signing out ends that session only", async () => {
  assert.equal((await call("POST", "/v1/account/logout", undefined, t2)).status, 200);
  assert.equal((await call("GET", "/v1/data", undefined, t2)).status, 401);
  assert.equal((await call("GET", "/v1/data", undefined, t1)).status, 200);
});

await step("deleting an account removes it, its sessions and its progress", async () => {
  assert.equal((await call("DELETE", "/v1/account")).status, 401);
  assert.equal((await call("DELETE", "/v1/account", undefined, t1)).status, 200);
  assert.equal((await call("POST", "/v1/account/login", { username: "ayesha", auth: AUTH })).status, 401);
  assert.deepEqual([sql("SELECT COUNT(*) AS c FROM accounts")[0].c, sql("SELECT COUNT(*) AS c FROM sessions")[0].c, sql("SELECT n FROM meta WHERE k='accounts'")[0].n], [0, 0, 0]);
});

await step("the account cap holds", async () => {
  for (const n of ["one", "two", "three"]) assert.equal((await call("POST", "/v1/account/signup", { username: `user-${n}`, auth: AUTH, code: CODE })).status, 201);
  const full = await call("POST", "/v1/account/signup", { username: "user-four", auth: AUTH, code: CODE });
  assert.equal(full.status, 503);
  assert.equal(full.body.error, "full");
});

console.log(`${checks} end-to-end groups passed`);
stop();
process.exit(0);
