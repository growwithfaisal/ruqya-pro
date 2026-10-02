// Resets a reader's password (they forgot it). Prints the SQL; it changes nothing by itself.
// Run:  npx tsx scripts/reset-password.mts <username> <new password>
// Then: npx wrangler d1 execute ruqyapro-reminders --remote --command "<the UPDATE it prints>"
// Their saved progress is kept; they sign in with the new password and every other device is signed out.
import { stretch } from "../../src/lib/account-crypto";
import { authHash, cleanUsername, isAuth, randomToken } from "../src/lib";

const [rawName, password] = process.argv.slice(2);
const username = cleanUsername(rawName);
if (!username || !password || password.length < 8) {
  console.error("Usage: npx tsx scripts/reset-password.mts <username> <new password of at least 8 characters>");
  process.exit(1);
}
const auth = await stretch(username, password);
if (!isAuth(auth)) throw new Error("unexpected stretched value");
const salt = randomToken();
const hash = await authHash(salt, auth);

console.log(`UPDATE accounts SET salt = '${salt}', auth_hash = '${hash}', fails = 0, locked_until = 0 WHERE username = '${username}';`);
console.log(`DELETE FROM sessions WHERE account_id = (SELECT id FROM accounts WHERE username = '${username}');`);
