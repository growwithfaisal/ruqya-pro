/**
 * The pure parts of the reminders server: nothing here touches Cloudflare, so it runs the same in Node for tests.
 *
 * The idea: a phone sends the minutes at which it wants to be poked. At each one the server sends an EMPTY web push to the
 * phone's push address; the phone's own service worker then looks up what to show. So the server never holds a reminder's text.
 */

/** Push services a browser can hand out an address for. The server only ever calls these hosts. */
const HOSTS: (string | RegExp)[] = [
  "web.push.apple.com", // Safari, and web apps on the iPhone Home Screen
  /^[a-z0-9-]+\.push\.apple\.com$/,
  "fcm.googleapis.com", // Chrome and other Chromium browsers on Android and desktop
  "updates.push.services.mozilla.com", // Firefox
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge
];

export function isAllowedEndpoint(raw: unknown, extraOrigins: string[] = []): boolean {
  if (typeof raw !== "string" || raw.length < 20 || raw.length > 700) return false;
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.username || u.password || u.hash) return false;
  if (extraOrigins.includes(u.origin)) return true; // local tests only: set EXTRA_ORIGINS in .dev.vars
  if (u.protocol !== "https:" || (u.port && u.port !== "443")) return false;
  return HOSTS.some((h) => (typeof h === "string" ? u.hostname === h : h.test(u.hostname)));
}

export const MINUTE = 60;
/** A poke later than this after its time is not sent: a prayer reminder that arrives 20 minutes late is wrong. */
export const STALE_AFTER = 15 * MINUTE;
export const MAX_TIMES = 600;
export const MAX_AHEAD = 60 * 24 * 3600;

/** The times a phone asked for, cleaned: whole minutes, in range, unique, ascending. Null when the request is malformed. */
export function cleanTimes(raw: unknown, now: number): number[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_TIMES + 100) return null;
  const out = new Set<number>();
  for (const t of raw) {
    if (typeof t !== "number" || !Number.isFinite(t)) return null;
    const m = Math.floor(t / MINUTE) * MINUTE;
    if (m >= now - MINUTE && m <= now + MAX_AHEAD) out.add(m);
  }
  return [...out].sort((a, b) => a - b).slice(0, MAX_TIMES);
}

export interface Plan {
  /** Poke this minute: at least one of the phone's times has just come and is not stale. */
  send: boolean;
  /** Times to keep if the poke worked (or none was needed). */
  after: number[];
  /** Times to keep if the push service was briefly unavailable: due ones stay for a retry until they go stale. */
  retry: number[];
}

/** What to do with one phone at `now`, given its ascending times. */
export function plan(times: number[], now: number): Plan {
  const due = times.filter((t) => t <= now);
  return {
    send: due.some((t) => t > now - STALE_AFTER),
    after: times.filter((t) => t > now),
    retry: times.filter((t) => t > now - STALE_AFTER),
  };
}

export const nextOf = (times: number[]) => times[0] ?? 0;

/* ---------- Small crypto helpers (WebCrypto, available in Workers and Node) ---------- */

const enc = new TextEncoder();
export const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
export const fromB64url = (s: string) => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};
export async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function randomToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(24)));
}
export function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
export function shardOf(idHex: string, shards: number): number {
  return shards > 1 ? parseInt(idHex.slice(0, 4), 16) % shards : 0;
}

/* ---------- VAPID (RFC 8292): proves to the push service which server is sending ---------- */

export interface VapidJwk { kty: "EC"; crv: "P-256"; x: string; y: string; d: string }

/** The public key a browser needs to subscribe, as the uncompressed point (65 bytes) in base64url. */
export function publicKeyOf(jwk: VapidJwk): string {
  const x = fromB64url(jwk.x), y = fromB64url(jwk.y);
  const out = new Uint8Array(65);
  out[0] = 4;
  out.set(x, 1);
  out.set(y, 33);
  return b64url(out);
}

export async function vapidJwt(jwk: VapidJwk, audience: string, subject: string, now: number, lifetime = 12 * 3600): Promise<string> {
  const head = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64url(enc.encode(JSON.stringify({ aud: audience, exp: now + lifetime, sub: subject })));
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`; // WebCrypto returns r||s, which is what JWS ES256 wants
}
