import {
  MINUTE, cleanTimes, isAllowedEndpoint, nextOf, plan, publicKeyOf, randomToken, sameString, sha256hex, shardOf,
  vapidJwt, type VapidJwk,
} from "./lib";

export interface Env {
  DB: D1Database;
  VAPID_PRIVATE_JWK: string; // secret: the signing key
  SUBJECT: string;
  ALLOWED_ORIGINS: string;
  MAX_SUBS: string;
  SYNC_GAP_SECONDS: string;
  SHARDS: string;
  /** Local tests only: extra origins the server may poke (a mock push service). Never set in production. */
  EXTRA_ORIGINS?: string;
}

const PER_RUN = 40; // the free plan allows 50 outbound calls per run; keep a few spare
/** With SHARDS > 1, each of these crons (all meaning "every minute") serves one shard. See README. */
const SHARD_CRONS = ["* * * * *", "*/1 * * * *", "0-59 * * * *", "*/1 0-23 * * *", "0-59 0-23 * * *"];
const nowSec = () => Math.floor(Date.now() / 1000);
const list = (s: string | undefined) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/* ---------- Pushing ---------- */

class Pusher {
  private jwts = new Map<string, Promise<string>>();
  private jwk: VapidJwk;
  readonly key: string;
  constructor(private env: Env) {
    this.jwk = JSON.parse(env.VAPID_PRIVATE_JWK) as VapidJwk;
    this.key = publicKeyOf(this.jwk);
  }
  /** One empty push. No body, so nothing to encrypt. Resolves to the push service's status, or 0 if it could not be reached. */
  async poke(endpoint: string): Promise<number> {
    try {
      const aud = new URL(endpoint).origin;
      let jwt = this.jwts.get(aud);
      if (!jwt) this.jwts.set(aud, (jwt = vapidJwt(this.jwk, aud, this.env.SUBJECT, nowSec())));
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { TTL: "600", Urgency: "high", Authorization: `vapid t=${await jwt}, k=${this.key}` },
      });
      await res.body?.cancel();
      return res.status;
    } catch {
      return 0;
    }
  }
}
const accepted = (s: number) => s >= 200 && s < 300;
const gone = (s: number) => s === 404 || s === 410;

/* ---------- HTTP ---------- */

function cors(req: Request, env: Env): Record<string, string> | null {
  const origin = req.headers.get("Origin");
  if (!origin) return {}; // not a browser (curl, tests)
  if (!list(env.ALLOWED_ORIGINS).includes(origin)) return null;
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", Vary: "Origin" };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });

interface Row { id: string; endpoint: string; token_hash: string; times: string; next_at: number; synced_at: number; tested_at: number }

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > 16_384) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch { return null; }
}

async function authed(env: Env, body: Record<string, unknown>): Promise<{ row: Row; id: string } | { id: string; row: null } | null> {
  const endpoint = body.endpoint;
  if (!isAllowedEndpoint(endpoint, list(env.EXTRA_ORIGINS))) return null;
  const id = await sha256hex(endpoint as string);
  const row = await env.DB.prepare("SELECT id, endpoint, token_hash, times, next_at, synced_at, tested_at FROM subs WHERE id = ?").bind(id).first<Row>();
  return { id, row };
}

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const h = cors(req, env);
  if (!h) return new Response("Origin not allowed", { status: 403 });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...h, "Access-Control-Max-Age": "86400" } });
  if (url.pathname === "/v1/health") return json({ ok: true }, 200, h);
  if (req.method !== "POST") return json({ error: "method" }, 405, h);

  const body = await readBody(req);
  if (!body) return json({ error: "body" }, 400, h);
  const found = await authed(env, body);
  if (!found) return json({ error: "endpoint" }, 400, h);
  const { row, id } = found;
  const token = typeof body.token === "string" ? body.token : "";
  const tokenOk = !!row && token.length >= 16 && sameString(await sha256hex(token), row.token_hash);
  const now = nowSec();

  if (url.pathname === "/v1/sync") {
    const times = cleanTimes(body.times, now);
    if (!times) return json({ error: "times" }, 400, h);
    if (row && !tokenOk) return json({ error: "token" }, 401, h);

    if (row) {
      if (now - row.synced_at < Number(env.SYNC_GAP_SECONDS || 15)) return json({ error: "slow-down" }, 429, h);
      if (!times.length) {
        await env.DB.batch([env.DB.prepare("DELETE FROM subs WHERE id = ?").bind(id), env.DB.prepare("UPDATE meta SET n = MAX(n - 1, 0) WHERE k = 'subs'")]);
        return json({ ok: true, count: 0 }, 200, h);
      }
      await env.DB.prepare("UPDATE subs SET times = ?, next_at = ?, synced_at = ? WHERE id = ?").bind(JSON.stringify(times), nextOf(times), now, id).run();
      return json({ ok: true, count: times.length, until: times[times.length - 1] }, 200, h);
    }

    // A new phone. Check there is room, and that the push address is real before keeping it.
    if (!times.length) return json({ ok: true, count: 0 }, 200, h);
    const count = (await env.DB.prepare("SELECT n FROM meta WHERE k = 'subs'").first<{ n: number }>())?.n ?? 0;
    if (count >= Number(env.MAX_SUBS || 20000)) return json({ error: "full" }, 503, h);
    const pusher = new Pusher(env);
    const status = await pusher.poke(body.endpoint as string);
    if (!accepted(status)) return json({ error: "rejected", status }, 400, h);
    const fresh = randomToken();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO subs (id, endpoint, token_hash, times, next_at, shard, synced_at, tested_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, body.endpoint as string, await sha256hex(fresh), JSON.stringify(times), nextOf(times), shardOf(id, Number(env.SHARDS || 1)), now, now, now),
      env.DB.prepare("UPDATE meta SET n = n + 1 WHERE k = 'subs'"),
    ]);
    return json({ ok: true, token: fresh, count: times.length, until: times[times.length - 1] }, 200, h);
  }

  if (!row || !tokenOk) return json({ error: "token" }, 401, h);

  if (url.pathname === "/v1/forget") {
    await env.DB.batch([env.DB.prepare("DELETE FROM subs WHERE id = ?").bind(id), env.DB.prepare("UPDATE meta SET n = MAX(n - 1, 0) WHERE k = 'subs'")]);
    return json({ ok: true }, 200, h);
  }

  if (url.pathname === "/v1/test") {
    if (now - row.tested_at < 5 * MINUTE) return json({ error: "slow-down" }, 429, h);
    await env.DB.prepare("UPDATE subs SET tested_at = ? WHERE id = ?").bind(now, id).run();
    const status = await new Pusher(env).poke(row.endpoint);
    if (gone(status)) {
      await env.DB.batch([env.DB.prepare("DELETE FROM subs WHERE id = ?").bind(id), env.DB.prepare("UPDATE meta SET n = MAX(n - 1, 0) WHERE k = 'subs'")]);
      return json({ error: "gone" }, 410, h);
    }
    return accepted(status) ? json({ ok: true }, 200, h) : json({ error: "push-failed", status }, 502, h);
  }

  return json({ error: "not-found" }, 404, h);
}

/* ---------- Scheduled work ---------- */

/** Every minute: poke the phones whose time has come. */
async function pokeDue(env: Env, shard: number) {
  const now = nowSec();
  const { results } = await env.DB
    .prepare("SELECT id, endpoint, times FROM subs WHERE shard = ? AND next_at > 0 AND next_at <= ? ORDER BY next_at LIMIT ?")
    .bind(shard, now, PER_RUN)
    .all<{ id: string; endpoint: string; times: string }>();
  if (!results.length) return { due: 0 };

  const pusher = new Pusher(env);
  const writes: D1PreparedStatement[] = [];
  let removed = 0;
  await Promise.all(results.map(async (r) => {
    let times: number[];
    try { times = (JSON.parse(r.times) as number[]).filter(Number.isFinite); } catch { times = []; }
    const p = plan(times, now);
    let keep = p.after;
    if (p.send) {
      const status = await pusher.poke(r.endpoint);
      if (gone(status)) { writes.push(env.DB.prepare("DELETE FROM subs WHERE id = ?").bind(r.id)); removed++; return; }
      if (!accepted(status)) keep = p.retry; // busy or unreachable: try again next minute until the time goes stale
    }
    writes.push(env.DB.prepare("UPDATE subs SET times = ?, next_at = ? WHERE id = ?").bind(JSON.stringify(keep), nextOf(keep), r.id));
  }));
  if (removed) writes.push(env.DB.prepare("UPDATE meta SET n = MAX(n - ?, 0) WHERE k = 'subs'").bind(removed));
  if (writes.length) await env.DB.batch(writes);
  return { due: results.length, removed };
}

/** Daily: drop phones with nothing left to send or that have not checked in for ages, and recount. */
async function tidy(env: Env) {
  const now = nowSec();
  await env.DB.prepare("DELETE FROM subs WHERE (next_at = 0 AND synced_at < ?) OR synced_at < ?").bind(now - 7 * 24 * 3600, now - 75 * 24 * 3600).run();
  await env.DB.prepare("UPDATE meta SET n = (SELECT COUNT(*) FROM subs) WHERE k = 'subs'").run();
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env).catch((e) => { console.error(e); return new Response("error", { status: 500 }); }),
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (event.cron === "0 3 * * *") ctx.waitUntil(tidy(env));
    else {
      const shard = Number(env.SHARDS || 1) > 1 ? Math.max(0, SHARD_CRONS.indexOf(event.cron)) : 0;
      ctx.waitUntil(pokeDue(env, shard).catch((e) => console.error(e)));
    }
  },
} satisfies ExportedHandler<Env>;
