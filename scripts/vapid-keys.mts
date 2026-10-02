// Makes the signing key pair the reminders server uses to prove who is sending (VAPID, RFC 8292).
// Run once:  npx tsx scripts/vapid-keys.mts
// - The PUBLIC key goes into the app (Vercel: NEXT_PUBLIC_PUSH_KEY).
// - The PRIVATE key stays secret and goes into the Worker:  npx wrangler secret put VAPID_PRIVATE_JWK
import { publicKeyOf, type VapidJwk } from "../reminders-worker/src/lib";

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as VapidJwk & { key_ops?: string[]; ext?: boolean };
const clean: VapidJwk = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d };

console.log("\nPUBLIC key (safe to share; put in Vercel as NEXT_PUBLIC_PUSH_KEY):\n");
console.log(publicKeyOf(clean));
console.log("\nPRIVATE key (keep secret; paste when `wrangler secret put VAPID_PRIVATE_JWK` asks):\n");
console.log(JSON.stringify(clean));
console.log("\nDo not commit the private key anywhere.\n");
