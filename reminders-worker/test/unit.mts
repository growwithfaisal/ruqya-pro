// Unit checks for the pure parts of the reminders server.  Run: npx tsx test/unit.mts
import assert from "node:assert/strict";
import { b64url, cleanTimes, fromB64url, isAllowedEndpoint, nextOf, plan, publicKeyOf, shardOf, vapidJwt, STALE_AFTER, type VapidJwk } from "../src/lib.ts";

let n = 0;
const ok = (name: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => { n++; }).catch((e) => { console.error("FAIL", name, "\n", e); process.exitCode = 1; });

await ok("only real push services are allowed", () => {
  for (const good of [
    "https://web.push.apple.com/QAbc123456789012345678901234567890",
    "https://fcm.googleapis.com/fcm/send/abcdefghijklmnopqrstuvwxyz0123456789",
    "https://updates.push.services.mozilla.com/wpush/v2/abcdefghijklmnopqrstuvwxyz",
    "https://wns2-par02p.notify.windows.com/w/?token=abcdefghijklmnop",
  ]) assert.equal(isAllowedEndpoint(good), true, good);
  for (const bad of [
    "http://web.push.apple.com/abcdefghijklmnopqrstuvwxyz", // not https
    "https://evil.example.com/fcm/send/abcdefghijklmnopqrstuvwxyz",
    "https://web.push.apple.com.evil.com/abcdefghijklmnopqrstuvwxyz",
    "https://fcm.googleapis.com:8443/fcm/send/abcdefghijklmnopqrstuvwxyz",
    "https://user:pw@fcm.googleapis.com/fcm/send/abcdefghijklmnopqrstuvwxyz",
    "https://127.0.0.1/abcdefghijklmnopqrstuvwxyz",
    "https://notify.windows.com.evil.io/abcdefghijklmnopqrstuvwxyz",
    "javascript:alert(1)//abcdefghijklmnopqrstuvwxyz",
    "", "short", 42, null, `https://fcm.googleapis.com/${"a".repeat(800)}`,
  ]) assert.equal(isAllowedEndpoint(bad), false, String(bad));
  assert.equal(isAllowedEndpoint("http://127.0.0.1:8799/ok/abcdefghijklmnop", ["http://127.0.0.1:8799"]), true);
  assert.equal(isAllowedEndpoint("http://127.0.0.1:9999/ok/abcdefghijklmnop", ["http://127.0.0.1:8799"]), false);
});

const NOW = 1_800_000_000; // minute-aligned
await ok("cleanTimes rounds, ranges, de-duplicates and sorts", () => {
  assert.deepEqual(cleanTimes([NOW + 125, NOW + 120, NOW + 60, NOW + 61], NOW), [NOW + 60, NOW + 120]);
  assert.deepEqual(cleanTimes([NOW - 10], NOW), [NOW - 60]); // just passed: still allowed so a time on this minute is kept
  assert.deepEqual(cleanTimes([NOW - 3600, NOW + 100 * 86400], NOW), []); // out of range is dropped, not an error
  assert.equal(cleanTimes("nope", NOW), null);
  assert.equal(cleanTimes([1, "x"], NOW), null);
  assert.equal(cleanTimes([NaN], NOW), null);
  assert.equal(cleanTimes(new Array(800).fill(NOW + 60), NOW), null); // far too many
  const many = Array.from({ length: 650 }, (_, i) => NOW + 60 * (i + 1));
  assert.equal(cleanTimes(many, NOW)!.length, 600);
});

await ok("plan: on time, early, late, retry", () => {
  const times = [NOW - 2 * 3600, NOW - 60, NOW + 600, NOW + 3600];
  const p = plan(times, NOW);
  assert.equal(p.send, true); // NOW-60 is fresh
  assert.deepEqual(p.after, [NOW + 600, NOW + 3600]);
  assert.deepEqual(p.retry, [NOW - 60, NOW + 600, NOW + 3600]); // the 2-hour-old one is stale and gone
  assert.equal(nextOf(p.after), NOW + 600);

  const early = plan([NOW + 60, NOW + 600], NOW);
  assert.equal(early.send, false);
  assert.deepEqual(early.after, [NOW + 60, NOW + 600]);

  const late = plan([NOW - STALE_AFTER - 60, NOW + 600], NOW); // missed by more than 15 minutes: skipped, never sent late
  assert.equal(late.send, false);
  assert.deepEqual(late.after, [NOW + 600]);

  const exactly = plan([NOW], NOW);
  assert.equal(exactly.send, true);
  assert.deepEqual(exactly.after, []);
  assert.equal(nextOf(exactly.after), 0);

  const edge = plan([NOW - STALE_AFTER], NOW); // exactly 15 minutes: stale
  assert.equal(edge.send, false);
});

await ok("plan advances across a day boundary", () => {
  const day = 86400;
  const times = [NOW, NOW + 600, NOW + day, NOW + day + 600];
  const a = plan(times, NOW);
  assert.deepEqual(a.after, [NOW + 600, NOW + day, NOW + day + 600]);
  const b = plan(a.after, NOW + day);
  assert.equal(b.send, true);
  assert.deepEqual(b.after, [NOW + day + 600]);
});

await ok("shards are even and stable", () => {
  const ids = Array.from({ length: 2000 }, (_, i) => (i * 2654435761 >>> 0).toString(16).padStart(8, "0") + "0000");
  const counts = [0, 0, 0, 0, 0];
  for (const id of ids) counts[shardOf(id, 5)]++;
  for (const c of counts) assert.ok(c > 300 && c < 500, `uneven ${counts}`);
  assert.equal(shardOf("ffffffff", 1), 0);
  assert.equal(shardOf("abcd1234", 5), shardOf("abcd1234", 5));
});

await ok("VAPID: public key, JWT shape and signature", async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const j = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as VapidJwk;
  const jwk: VapidJwk = { kty: j.kty, crv: j.crv, x: j.x, y: j.y, d: j.d };

  const pub = fromB64url(publicKeyOf(jwk));
  assert.equal(pub.length, 65);
  assert.equal(pub[0], 4);
  // The point really is the public key: import it and verify a signature made with the private half.
  const jwt = await vapidJwt(jwk, "https://web.push.apple.com", "https://ruqya-pro11.vercel.app", NOW);
  const [h, c, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(new TextDecoder().decode(fromB64url(h))), { typ: "JWT", alg: "ES256" });
  assert.deepEqual(JSON.parse(new TextDecoder().decode(fromB64url(c))), { aud: "https://web.push.apple.com", exp: NOW + 43200, sub: "https://ruqya-pro11.vercel.app" });
  assert.equal(fromB64url(s).length, 64); // r||s, not DER
  const pubKey = await crypto.subtle.importKey("raw", pub, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  assert.equal(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pubKey, fromB64url(s), new TextEncoder().encode(`${h}.${c}`)), true);
  assert.equal(b64url(fromB64url("AAEC_w")), "AAEC_w");
});

console.log(`${n} unit groups passed${process.exitCode ? ", with failures" : ""}`);
