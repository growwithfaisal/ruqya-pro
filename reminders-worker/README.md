# RuqyaPro reminders server

A tiny Cloudflare Worker + D1 database that sends an **empty web push** to a phone at the minutes that phone asked for.
It never sees what a reminder says: the phone keeps its own schedule and its service worker decides what to show.

What the server stores per phone: the push address (a secret URL from Apple, Google or Mozilla), a hash of a secret only that phone holds, and a list of minute timestamps. Nothing else: no location, no names, no prayer names, no verses.

Runs on Cloudflare's free plan: about 40 pokes per minute (see "Limits"), up to 20,000 phones.

## One-time setup (needs your Cloudflare login, run from this folder)

```bash
npm install
npx wrangler login
npx wrangler d1 create ruqyapro-reminders
```

Copy the `database_id` it prints into `wrangler.toml` (replace the zeros). Then:

```bash
npx wrangler d1 migrations apply ruqyapro-reminders --remote
npx tsx ../scripts/vapid-keys.mts
npx wrangler secret put VAPID_PRIVATE_JWK
npx wrangler deploy
```

`vapid-keys.mts` prints a PUBLIC key and a PRIVATE key. Paste the private one (the `{"kty":...}` line) when `secret put` asks. Never commit it.

`wrangler deploy` prints the Worker's address (`https://ruqyapro-reminders.<you>.workers.dev`).

In Vercel (Project > Settings > Environment Variables) add, for Production (this project instead keeps the same two public values in `.env.production` at the project root, which `next build` reads, so no dashboard step was needed):

- `NEXT_PUBLIC_REMINDERS_URL` = the Worker's address
- `NEXT_PUBLIC_PUSH_KEY` = the PUBLIC key

then redeploy. The Reminders section appears in Settings only when both are set. If the app moves to a new web address, add it to `ALLOWED_ORIGINS` in `wrangler.toml` and `npx wrangler deploy` again.

## Checking it

```bash
npm test          # unit checks, then the Worker under wrangler dev against a mock push service
curl https://<worker address>/v1/health
npx wrangler tail # live log while a phone turns reminders on
```

## Limits (free plan)

- Cloudflare allows 50 outbound calls per run, so one run pokes up to 40 phones. Everyone in a city wants Asr in the same minute, so beyond a few hundred people in one place some reminders arrive a few minutes late (a reminder more than 15 minutes late is skipped).
- Possible headroom: set `SHARDS = "5"` and list the five "every minute" crons in `[triggers]` (`* * * * *`, `*/1 * * * *`, `0-59 * * * *`, `*/1 0-23 * * *`, `0-59 0-23 * * *`). Untested: check `wrangler tail` that all five fire. Paying $5 a month for Workers Paid removes the cap.
- D1 free plan: 100,000 writes a day. Each poke and each schedule refresh is one write.
- If a free daily cap is hit, reminders pause until it resets.

## Housekeeping

A daily job (03:00 UTC) removes phones with nothing left to send or that have not checked in for 75 days. A phone whose push address the push service reports as gone is removed at its next poke.
