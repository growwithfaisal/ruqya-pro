/**
 * What a phone sends instead of a password. The password is stretched here, in the browser (PBKDF2, 600,000 rounds, salted with
 * the username), and only the 32-byte result goes to the server, which stores a salted hash of it. So the raw password never
 * leaves the device, and the server does no slow hashing (the free plan allows only 10 ms of CPU a request).
 * The owner's reset script (reminders-worker/scripts/reset-password.mts) uses this same function.
 */
export const ROUNDS = 600_000;

const b64url = (bytes: ArrayBuffer) => {
  let s = "";
  for (const x of new Uint8Array(bytes)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function stretch(username: string, password: string, rounds = ROUNDS): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(`rp-auth:${username.trim().toLowerCase()}`), iterations: rounds },
    key,
    256,
  );
  return b64url(bits);
}
