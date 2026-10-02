import { authHash, cleanUsername, isAuth, open, randomToken, sameString, seal, sha256hex, b64url } from "./lib";

/**
 * Optional accounts. A reader picks a username and a password; their phone stretches the password (PBKDF2) and sends only the
 * result, so the raw password never arrives here. The account holds one thing: a copy of their reading progress, sealed with a
 * key that exists only as a Worker secret. Sessions are random tokens of which only a hash is kept.
 */
export interface AccountEnv {
  DB: D1Database;
  SIGNUP_CODE?: string; // secret: the invite code for creating an account. Unset means anyone may.
  DATA_KEY?: string; // secret: 32 random bytes, base64url, seals the stored progress
  MAX_ACCOUNTS?: string;
}

const MAX_DATA = 300_000;
const LOCK_AFTER = 5;
const LOCK_FOR = 15 * 60;
const SESSION_LIFE = 90 * 24 * 3600;
const MAX_SESSIONS = 10;
const nowSec = () => Math.floor(Date.now() / 1000);

type Headers_ = Record<string, string>;
const reply = (body: unknown, status: number, h: Headers_) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...h } });

async function body(req: Request): Promise<Record<string, any> | null> {
  const text = await req.text();
  if (text.length > MAX_DATA + 2000) return null;
  try { const v = JSON.parse(text); return v && typeof v === "object" ? v : null; } catch { return null; }
}

const bearer = (req: Request) => /^Bearer ([\w-]{16,100})$/.exec(req.headers.get("Authorization") ?? "")?.[1] ?? null;

async function session(req: Request, env: AccountEnv) {
  const token = bearer(req);
  if (!token) return null;
  const th = await sha256hex(token);
  const row = await env.DB.prepare("SELECT s.created_at, s.seen_at, a.id, a.username FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?").bind(th).first<{ created_at: number; seen_at: number; id: string; username: string }>();
  const now = nowSec();
  if (!row || now - row.created_at > SESSION_LIFE) return null;
  if (now - row.seen_at > 24 * 3600) await env.DB.prepare("UPDATE sessions SET seen_at = ? WHERE token_hash = ?").bind(now, th).run();
  return { id: row.id, username: row.username, th };
}

async function newSession(env: AccountEnv, accountId: string): Promise<{ token: string; statements: D1PreparedStatement[] }> {
  const token = randomToken();
  const now = nowSec();
  return {
    token,
    statements: [
      env.DB.prepare("INSERT INTO sessions (token_hash, account_id, created_at, seen_at) VALUES (?, ?, ?, ?)").bind(await sha256hex(token), accountId, now, now),
      env.DB.prepare("DELETE FROM sessions WHERE account_id = ? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE account_id = ? ORDER BY created_at DESC LIMIT ?)").bind(accountId, accountId, MAX_SESSIONS),
    ],
  };
}

/** Handles /v1/account/* and /v1/data. Null when the path is not an account route. */
export async function accountRoutes(req: Request, env: AccountEnv, url: URL, h: Headers_): Promise<Response | null> {
  const p = url.pathname;
  const now = nowSec();

  if (p === "/v1/account/signup" && req.method === "POST") {
    const b = await body(req);
    if (!b) return reply({ error: "body" }, 400, h);
    if (env.SIGNUP_CODE) {
      const given = typeof b.code === "string" ? b.code.trim() : "";
      if (!sameString(await sha256hex(given), await sha256hex(env.SIGNUP_CODE))) return reply({ error: "code" }, 403, h);
    }
    const username = cleanUsername(b.username);
    if (!username) return reply({ error: "username" }, 400, h);
    if (!isAuth(b.auth)) return reply({ error: "auth" }, 400, h);
    const count = (await env.DB.prepare("SELECT n FROM meta WHERE k = 'accounts'").first<{ n: number }>())?.n ?? 0;
    if (count >= Number(env.MAX_ACCOUNTS || 300)) return reply({ error: "full" }, 503, h);

    const id = b64url(crypto.getRandomValues(new Uint8Array(16)));
    const salt = randomToken();
    const { token, statements } = await newSession(env, id);
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO accounts (id, username, salt, auth_hash, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, username, salt, await authHash(salt, b.auth), now),
        ...statements,
        env.DB.prepare("UPDATE meta SET n = n + 1 WHERE k = 'accounts'"),
      ]);
    } catch (e) {
      if (String(e).includes("UNIQUE")) return reply({ error: "taken" }, 409, h);
      throw e;
    }
    return reply({ token, username }, 201, h);
  }

  if (p === "/v1/account/login" && req.method === "POST") {
    const b = await body(req);
    const username = cleanUsername(b?.username);
    if (!b || !username || !isAuth(b.auth)) return reply({ error: "invalid" }, 401, h);
    const row = await env.DB.prepare("SELECT id, salt, auth_hash, fails, locked_until FROM accounts WHERE username = ?").bind(username).first<{ id: string; salt: string; auth_hash: string; fails: number; locked_until: number }>();
    if (row && row.locked_until > now) return reply({ error: "locked", retryAfter: row.locked_until - now }, 429, h);
    // Same work whether or not the name exists, so the answer does not reveal which names are taken.
    const candidate = await authHash(row?.salt ?? "no-such-account", b.auth);
    const good = !!row && sameString(candidate, row.auth_hash);
    if (!row || !good) {
      if (row) {
        const fails = row.fails + 1;
        await env.DB.prepare("UPDATE accounts SET fails = ?, locked_until = ? WHERE id = ?").bind(fails >= LOCK_AFTER ? 0 : fails, fails >= LOCK_AFTER ? now + LOCK_FOR : 0, row.id).run();
      }
      return reply({ error: "invalid" }, 401, h);
    }
    const { token, statements } = await newSession(env, row.id);
    await env.DB.batch([...(row.fails ? [env.DB.prepare("UPDATE accounts SET fails = 0 WHERE id = ?").bind(row.id)] : []), ...statements]);
    return reply({ token, username }, 200, h);
  }

  if (p === "/v1/account/logout" && req.method === "POST") {
    const s = await session(req, env);
    if (s) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(s.th).run();
    return reply({ ok: true }, 200, h);
  }

  if (p === "/v1/account" && req.method === "DELETE") {
    const s = await session(req, env);
    if (!s) return reply({ error: "session" }, 401, h);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE account_id = ?").bind(s.id),
      env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(s.id),
      env.DB.prepare("UPDATE meta SET n = MAX(n - 1, 0) WHERE k = 'accounts'"),
    ]);
    return reply({ ok: true }, 200, h);
  }

  if (p === "/v1/data" && (req.method === "GET" || req.method === "PUT")) {
    const s = await session(req, env);
    if (!s) return reply({ error: "session" }, 401, h);
    if (!env.DATA_KEY) return reply({ error: "not-configured" }, 500, h);
    const current = async () => {
      const r = await env.DB.prepare("SELECT rev, data, data_at FROM accounts WHERE id = ?").bind(s.id).first<{ rev: number; data: string | null; data_at: number }>();
      return { rev: r?.rev ?? 0, data: r?.data ? await open(r.data, env.DATA_KEY!, s.id) : null, at: r?.data_at ?? 0 };
    };
    if (req.method === "GET") return reply(await current(), 200, h);

    const b = await body(req);
    if (!b || typeof b.data !== "string" || b.data.length > MAX_DATA || !Number.isInteger(b.baseRev) || b.baseRev < 0) return reply({ error: "body" }, 400, h);
    try { const parsed = JSON.parse(b.data); if (!parsed || typeof parsed !== "object") throw new Error(); } catch { return reply({ error: "data" }, 400, h); }
    const res = await env.DB.prepare("UPDATE accounts SET data = ?, rev = rev + 1, data_at = ? WHERE id = ? AND rev = ?")
      .bind(await seal(b.data, env.DATA_KEY, s.id), now, s.id, b.baseRev).run();
    if (!res.meta.changes) return reply({ error: "conflict", ...(await current()) }, 409, h);
    return reply({ ok: true, rev: b.baseRev + 1, at: now }, 200, h);
  }

  return null;
}
