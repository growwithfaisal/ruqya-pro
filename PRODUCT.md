# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Pinned by the owner's brief (BRIEF.md): Next.js App Router + TypeScript + Tailwind on Vercel, static JSON content (no database), Framer Motion, Radix/shadcn Sheet, Amiri or Scheherazade New for Arabic, Fuse.js-style client search. No accounts, no audio, no analytics beyond Vercel's basic.

## Users

Muslims (mobile-first, English readers) seeking authentic shar'i ruqyah: people wanting a daily protection routine, people in physical pain or worried about evil eye, and people learning to perform self-ruqyah. They are often anxious, and often already exposed to charlatans and social-media ruqyah claims. They open the app in the morning, evening and before sleep, on a phone, often in low light.

## Product Purpose

A fast, calm guide to authentic ruqyah: step-through self-ruqyah, a swipeable recitation library where every dua carries a verifiable source, red flags for scammers, and holistic wellness. Success is a user who recites correctly from a verified text, trusts why, can spot a charlatan, and keeps seeking medical care alongside ruqyah.

## Positioning

Transparent sourcing. Every dua shows a citation badge that opens a drawer with full Arabic (tashkeel), grade, book, chapter, exegesis and a deep link to /sources. Unlike social-media ruqyah accounts, nothing is published without a Sahih/Hasan grade, a source, and owner verification.

## Operating Context

- Content pipeline: Quran text matched against a cited Uthmani dataset (Tanzil or Quran.com API); hadith text and grading cross-checked against sunnah.com and Dorar.net (graders: Albani / Arna'ut); transliteration only from cited repos/datasets, recorded in SOURCES.md with URL, license and commit hash.
- `/content-source/` (delivered as `content/`) is 31 phone screenshots (Instagram stories from a raqi, one Quran-app verse list), not text. Decision: they are a checklist of wanted ayat/duas only. No Arabic is transcribed from them; their unsourced counts and claims are not carried over.
- Source docs named in the brief ("A Comprehensive Ruqyah Guide", "Platform Architectural Specification") have not been supplied yet.
- Owner performs a verification pass that flips `verified` to true before deploy.

## Capabilities and Constraints

- Nav: Home | Qur'an | Self-Ruqyah | Recitations | Sources | Search | Settings. On phones a bottom tab bar holds the first four plus More (Sources, Search, Settings); desktop keeps the top bar. The page's sky (dawn/day/dusk/night) follows the real sunrise, Fajr, Maghrib and Isha at the saved place, falling back to fixed clock hours when no place is saved. Anyone who has not yet added the app gets an "Add to Home Screen" card at the top of Home (and a row in Settings): on Android Chrome, Samsung Internet, Edge and desktop Chrome one tap opens the browser's own install dialog; on iPhone, iPad and Mac Safari, where Apple gives pages no way to do it, a big three-step guide with an arrow toward the Share button; inside another app's browser (Instagram, Facebook, TikTok) it says to open the site in Safari or Chrome first. "Not now" hides it for a week; it never shows once the app is installed. On screens 1024px and wider the Qur'an keeps the surah list beside the reader; a phone held sideways gets a compact two-column reader. Settings holds a one-tap "Download everything" (all pages, assets and the whole Qur'an into Cache Storage, kept fresh after deploys) a "Your progress" backup (Save a backup / Restore from a backup: a JSON file the reader keeps in Files or iCloud, made and read on the device; deleting the home-screen app erases local data, so this is the only way it survives a reinstall without breaking the no-server rule), and the reading preferences. Settings is ordered by how often it is used: Reading, Prayer times, Use without internet, Your progress, with four jump links under the title. Red Flags and Wellness are paused by the owner and will be added back on request (the earlier placeholder pages are in git history).
- Reminders (opt-in, Settings > Reminders; hidden until the reminder server is configured): notifications for the five prayers (at the time, or 5/10/15/30 minutes before), morning / evening / bedtime adhkar at times the reader sets (defaults 7:00, 17:00, 22:00; each opens its routine), Friday's Surah Al-Kahf (default 9:00), and optionally two verses a day (defaults 11:00 and 20:00; Saheeh International translation of a verse of 140 characters or fewer, drawn the same way each time for a date, opening the verse in the reader). Works only on an installed home-screen app on iPhone; permission is asked only when the reader taps the switch. The phone works out a 45-day schedule and keeps all the wording on the phone; the server (a free Cloudflare Worker + D1, `reminders-worker/`) is told only a push address, a secret that belongs to the phone, and the minutes at which to send an empty push, so it never sees locations, prayers, adhkar or which verses were chosen. The times can show roughly which part of the world someone is in, and the Settings text says so. "Turn off and delete" removes the record. Reminders stop if the app is not opened for about 45 days. Not part of the progress backup.
- Accounts (optional, Settings > Account; pilot): a reader can create a username + password account (no email) so their progress follows them between devices, including laptop Safari, which deletes a browser tab's saved data after seven days of Safari use without a visit. During the pilot, creating an account needs an invite code the owner hands out (a Worker secret, changeable). Synced: reading days, bookmarks, "seen today", place in the Qur'an, the last 14 routine days of ticks, and (adopted only when a device first signs in) the reading settings. Never synced: the saved prayer location, reminders, offline downloads. The phone stays the main copy and everything works signed out. Lists merge three ways against the last agreed copy, so a bookmark deleted on one device is not brought back by another. The password is stretched in the browser (PBKDF2, 600,000 rounds) and only that result is sent; the server stores a salted hash. The server can read the progress (sealed at rest with a Worker secret, not end-to-end encrypted), which lets the owner reset a forgotten password without losing the cloud copy (`reminders-worker/scripts/reset-password.mts`); the Settings text says so. Sign out keeps the device's data; Delete account removes the server copy.
- Night mode: a switch in the header (a round half-filled-disc button beside Search, on every page) and at the top of Settings. On, the whole app holds its night palette, whatever the hour, until it is switched off; off, the sky follows the real sun at the saved place as before. It changes colour only: Home's sun, headline and Morning / Evening / Bedtime tile still follow the real hour, and the prayer card keeps its own sky. A `?sky=` preview still wins. Kept on this device (`rp:v1:night`), restored from a progress backup, and painted before first paint so there is no flash of day.
- Home shows an "Ayah of the day" (one verse drawn from the whole Qur'an by the device's local date, so it changes at local midnight; the card shows the Saheeh International translation only, with a link to read the verse in the reader; verses too long for a card are left out of the draw). The four topic rows (Daily protection, Physical pain, Suspected evil eye, Learning self-ruqyah) stay on Home, above the ayah; the medical disclaimer sits on Home only, at the bottom.
- Qur'an reader: all 114 surahs verse by verse (Arabic, optional transliteration and Saheeh International translation), Chapter/Juz browsing with search, verse picker, resume where you stopped, bookmarks, a daily reading streak (a day counts after 10 verses; the pill shows days read this month out of 30), and per-surah offline saving.
- Prayer times (Home, directly under the hero tiles: the adhkar, Friday and Continue-reading tiles): one card with the current prayer and its time, a thin progress line to the next, and "Maghrib in 2 h 14 min". Holding a finger on the card (or right-clicking it) opens a slide-over with all six times for today (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha), the running one marked Now and the next with its countdown, plus the method and Asr school in use and a link to change them in Settings; after Isha it adds tomorrow's Fajr. A small "All times" button on the card opens the same panel for taps, keyboards and screen readers. Worked out on the device from the sun's position (adhan, MIT) at the device's location, so it works offline and nothing is sent anywhere. Location is asked only when the reader taps "Show prayer times", stored rounded to ~1 km in `rp:v1:prayer:place` (not part of backups); method and Asr school are set in Settings (method defaults to the region's usual one from the device time zone). Between sunrise and Dhuhr the card says Sunrise, since no prayer is current then.
- Recitations tab: the four needs (Daily protection, Physical pain, Suspected evil eye, Learning self-ruqyah) as rows; each opens in the same one-card reader as the adhkar and keeps its own ticks for the routine day (a recitation ticked in one category, or in an adhkar set, is not ticked in another). Home's topic rows open the same readers. I'm Done in a category returns to the Recitations tab.
- Transliteration guide: a slide-over panel ("How to read the transliteration") opened from a row in the Reading settings, in the Qur'an and routine readers and in the Settings tab. It explains the underlined letters, the faded letters that are not said (and the verse-final n), plain letters and a quick key, with examples in the live mark styles.
- Routine progress (the ticks on Home's morning/evening/bedtime tile) is saved per routine and per routine day. A routine day starts at 04:00 when the morning set begins, so a bedtime read after midnight counts for the night before, never for tonight. Ticks saved by earlier versions carry over except bedtime ones, which could have been made after midnight.
- **Standing rules for every feature:** user data stays on the user's own device (no accounts; the two opt-in exceptions are the reminders and the accounts below, each served by a small free Cloudflare server); the app is used as a home-screen web app, so it must work standalone and offline where sensible; every deploy must reach people who already installed it (network-first pages, build-id service worker, saved content in its own persistent cache).
- Editorial invariant enforced by build: a published entry needs `verified: true`, a source, and grade Sahih or Hasan. `scripts/validate-content.ts` runs in the build.
- Never generate or alter Arabic, transliteration or gradings from model memory; never normalise Quranic Arabic; missing values go to `MISSING.md` and the entry stays unpublished.
- No images of living beings; no talismans, "energy", or occult language.
- Medical disclaimer (ruqyah complements medical and mental-health care, never replaces it): shown on Home only, below the ayah of the day, at the owner's direction. It is no longer in the footer or on other pages.
- Device local time only; no location or prayer-time API in v1.
- Undecided: domain, logo/wordmark (Canva), whether ayat keep swipe-to-dismiss.

## Brand Commitments

Name: RuqyaPro. Voice: calm, plain, trustworthy. No individual raqi is credited. Graders: Albani / Arna'ut.

## Evidence on Hand

31 screenshots in `content/` (unsourced, ungraded, not usable as text). No verified entries exist yet; nothing may be presented as verified until the owner flips the flag.

## Product Principles

1. Sourcing is the product: every sacred string traces to a citation the user can open in one tap.
2. Sacred text is never animated or altered; motion belongs to the container.
3. Calm over urgency: no fear-based copy, no miracle claims, no counts or timings without a sound source.
4. Medicine first, ruqyah alongside.
5. Unpublished beats unverified.

## Accessibility & Inclusion

WCAG AA contrast, `prefers-reduced-motion` respected, large tap targets, correct RTL, adjustable Arabic size, keyboard and button alternatives to every swipe gesture.
