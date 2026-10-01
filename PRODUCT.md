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

- Nav: Home | Qur'an | Self-Ruqyah | Recitations | Sources | Search | Settings. Settings holds a one-tap "Download everything" (all pages, assets and the whole Qur'an into Cache Storage, kept fresh after deploys) and the reading preferences. Red Flags and Wellness are paused by the owner and will be added back on request (the earlier placeholder pages are in git history).
- Home shows an "Ayah of the day" (one verse drawn from the whole Qur'an by the device's local date, so it changes at local midnight; verses too long for a card are left out of the draw). The intent selector rows were removed from Home at the owner's request; the medical disclaimer stays in the footer of every page.
- Qur'an reader: all 114 surahs verse by verse (Arabic, optional transliteration and Saheeh International translation), Chapter/Juz browsing with search, verse picker, resume where you stopped, bookmarks, a daily reading streak (a day counts after 10 verses; the pill shows days read this month out of 30), and per-surah offline saving.
- **Standing rules for every feature:** user data stays on the user's own device (no accounts, no servers); the app is used as a home-screen web app, so it must work standalone and offline where sensible; every deploy must reach people who already installed it (network-first pages, build-id service worker, saved content in its own persistent cache).
- Editorial invariant enforced by build: a published entry needs `verified: true`, a source, and grade Sahih or Hasan. `scripts/validate-content.ts` runs in the build.
- Never generate or alter Arabic, transliteration or gradings from model memory; never normalise Quranic Arabic; missing values go to `MISSING.md` and the entry stays unpublished.
- No images of living beings; no talismans, "energy", or occult language.
- Permanent, visible medical disclaimer (home, intent selector, footer): ruqyah complements medical and mental-health care, never replaces it.
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
