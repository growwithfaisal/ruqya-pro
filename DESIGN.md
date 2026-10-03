---
name: RuqyaPro
description: A calm, luminous guide to authentic ruqyah, lit by the reader's own hour of the day.
colors:
  day-sky-top: "oklch(0.9 0.06 225)"
  day-sky-bottom: "oklch(0.975 0.022 200)"
  day-ink: "oklch(0.25 0.055 235)"
  day-accent: "oklch(0.42 0.11 175)"
  dawn-sky-top: "oklch(0.83 0.08 290)"
  dawn-sky-bottom: "oklch(0.945 0.05 45)"
  dawn-ink: "oklch(0.24 0.07 295)"
  dawn-accent: "oklch(0.44 0.15 15)"
  dusk-sky-top: "oklch(0.3 0.09 320)"
  dusk-sky-bottom: "oklch(0.46 0.12 30)"
  dusk-ink: "oklch(0.975 0.02 75)"
  dusk-accent: "oklch(0.86 0.13 80)"
  night-sky-top: "oklch(0.16 0.05 270)"
  night-sky-bottom: "oklch(0.25 0.06 250)"
  night-ink: "oklch(0.96 0.014 250)"
  night-accent: "oklch(0.86 0.09 195)"
typography:
  display:
    fontFamily: "Hedvig Letters Serif, Georgia, serif"
    fontSize: "clamp(2.1rem, 7vw, 3.6rem)"
    fontWeight: 400
    lineHeight: 1.06
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  arabic:
    fontFamily: "Amiri, serif"
    fontSize: "calc(1.9rem * var(--arabic-scale))"
    fontWeight: 400
    lineHeight: 2.15
rounded:
  card: "28px"
  row: "20px"
  hairline: "6px"
  arch: "50% 50% 28px 28px / 150px 150px 28px 28px"
  pill: "9999px"
spacing:
  gutter: "16px"
  section: "56px"
components:
  button-primary:
    backgroundColor: "{colors.day-accent}"
    textColor: "oklch(0.985 0.01 175)"
    rounded: "{rounded.card}"
    padding: "12px 20px"
    height: "72px"
  chip:
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  recitation-card:
    rounded: "{rounded.arch}"
    padding: "72px 24px 0"
---

# Design System: RuqyaPro

## Overview

**Creative North Star: "The Day Is the Interface"**

RuqyaPro is lit by the reader's own hour. Four sky states (dawn, day, dusk, night) are chosen from device local time and set the ground gradient, ink, accent and card surface together. Nothing else in the app knows the hour. A single orb sits on a hairline arc at the true position of the sun or moon; the primary action beneath it is the adhkar set for that hour.

The register is quiet and exact: hairline rules instead of boxes, large display serif for the few sentences that matter, and sacred text set steadily inside arch-shaped niches. Ornament is one drifting eight-fold star lattice at roughly 10% opacity, and abstract geometric marks. No figures, no crescent clip art, no occult vocabulary.

**Key Characteristics:**
- Four OKLCH sky palettes swapped by a `data-sky` attribute set before first paint.
- Arch-niche recitation cards; everything else is ruled rows on the sky.
- Arabic is never animated; only its container moves.
- Every sacred string carries a citation badge.

## Colors

Committed, drenched-by-sky: the page ground is the palette. Each sky defines `--sky-top`, `--sky-bottom`, `--ink`, `--ink-soft`, `--accent`, `--card`, `--card-ink`, `--card-soft`, `--line`, `--lattice`, `--orb`.

### Primary
- **Deep Sea-Glass Teal** (oklch(0.42 0.11 175)): day accent for the primary action, grade tags and links.
- **Brick Rose** (oklch(0.44 0.15 15)): dawn accent.
- **Lantern Gold** (oklch(0.86 0.13 80)): dusk accent, dark ink on it.
- **Moon Ice** (oklch(0.86 0.09 195)): night accent, dark ink on it.

### Neutral
- **Aqua Vellum / Lilac Apricot / Plum Ember / Deep Indigo**: the four sky grounds, top to bottom gradient.
- **Sky Ink**: the reading colour, always tinted from the sky hue, never grey.

### Named Rules
**The One Sky Rule.** Colour comes from the current sky and nothing else. A component never hard-codes a hue.
**The Draft Amber Rule.** Unverified content is marked in `--draft` amber with a dashed border, everywhere it appears. Nothing else uses dashed amber.

## Typography

**Display Font:** Hedvig Letters Serif (Georgia fallback)
**Body Font:** Schibsted Grotesk (system-ui fallback)
**Arabic Font:** Amiri, full tashkeel, scaled by the reader through `--arabic-scale` (0.8 to 1.8)

**Character:** a warm humanist serif for the few sentences that carry the mood, a plain grotesque for reading, and a calligraphic naskh for sacred text.

### Hierarchy
- **Display** (400, clamp(2.1rem, 7vw, 3.6rem), 1.06): the hour's line on Home.
- **Page title `.t-h1`** (400, clamp(2rem, 6vw, 3rem), 1.2): the title of every page.
- **Section lead `.t-h2-lead`** (400, clamp(1.8rem, 5vw, 2.5rem), 1.2): the moments on Home (topics, Ayah of the day).
- **Section title `.t-h2`** (400, clamp(1.6rem, 4.5vw, 2.1rem), 1.2): sections inside a page.
- **Card heading `text-h3`** (400, 1.5rem) and **row title `text-title`** (400, 1.3rem): cards, rows, sheets.
- **Lead `text-lead`** (1.1rem), **Body** (400, 1rem, 1.6, capped near 65ch), **Small `text-small`** (0.95rem), **Meta `text-meta`** (0.9rem). Buttons use 1.05rem; the tab bar labels use 0.72rem. Nothing else is a size.
- **Arabic** (400, 1.9rem at scale 1, 2.15): centred, RTL, `lang="ar"`.

### Named Rules
**The Steady Text Rule.** No fade, scramble, typewriter or transform on Arabic. Animate the card, never the words.

## Layout

Mobile-first single column with a 16px gutter, `max-w-5xl` container, two columns from 768px on Home: the hero is "sky | action" (the sun's arc and the prayer card on the left; the line for the hour and the tiles on the right), and the topic rows run two across between 768 and 1023px, then sit beside their heading from 1024px. Sections are separated by generous space and hairline rules, not boxes. The inline navigation appears from 1024px; below that a glass tab bar (Home, Qur'an, Recitations, Self-Ruqyah, More) sits at the bottom edge, with Sources, Search and Settings under More, and it steps aside on the reading screens that own the bottom edge. Every page uses `PageShell`: `narrow` (max-w-2xl) for app screens, `wide` (3xl) for reference pages, `deck` (5xl). Rows are at least 44px tall; primary controls 56px (`.btn`), secondary and utility 44px (`.btn-sm`), hero tiles `.cta` (72px, 28px radius).

## Elevation & Depth

A light touch of frosted glass sits over the tonal layering: cards (`.glass`, 72% of the card colour, 16px blur), sheets and the menu (`.glass-strong`, 88%, 24px), the sticky header (`.glass-bar`, 64% of the sky top, 16px) and a few pills and the search field (`.glass-chip`, 42%, 10px), each with a soft diagonal sheen. The drifting sky and lattice show faintly through while text keeps its contrast. The swipe deck keeps solid faces, because backdrop blur would flatten its 3D flip. Every glass surface becomes solid where blur is unavailable or `prefers-reduced-transparency` is set.

Tonal layering with two soft shadows. The recitation card has one offset, wide-blur shadow (`0 24px 48px -20px rgb(0 0 0 / 0.35)`); drawers use an upward version. Cards behind the top card are the same shape at 60% and 30% opacity, shifted down, to suggest a deck.

## Shapes

Three radii only: 28px for cards, sheets and hero tiles; 20px for list rows and small tiles (verse numbers); full pills for controls and fields.

The signature silhouette is the arch niche: `border-radius: 50% 50% 28px 28px / 150px 150px 28px 28px`. Controls are full pills; drawers have 28px top corners. Hairlines are 1px `--line`.

## Components

### Recitations tab
- The tab is the five needs as outlined 20px-radius rows (glyph, label, blurb, then "13 recitations", "3 of 13 recited today" or an accent "All 13 recited today" chip, chevron). Each need has its own abstract line glyph, none a figure or a crescent: a star, concentric ripples, two overlapping rings, stacked layers (Financial Blockages) and a wave (Emotional Reset). Tapping a row opens the category in the one-card reader (`RoutineReader`), exactly like the morning, evening and bedtime adhkar, with its own progress for the day; I'm Done returns to the tab. There are no pill tabs, search box or flat list here; individual recitation pages remain for Search, Sources and "Read in full".

### Self-Ruqyah page
- Four ruled sections on the sky, no boxes, in this order: Preparation, How it was done, Ruqyah Ayats, Ruqyah Duas. Each has a display-face heading and one plain line.
- **Preparation** (`Preparation`) is a numbered ruled list: the numeral in the accent display face, one instruction in body size, and under it, only where a source exists, an underlined link to the book (sunnah.com, or the Qur'an reader) followed by the grade. The Durood step carries its own expandable row so its Arabic can be read in place.
- **How it was done** (`MethodReports`) shows the first report as a glass card with a heading and the narration clamped to about four lines (92px) under a soft fade into the card colour; a quiet pill button below reads "Show more" with a chevron. It animates the card open to the full quote and reveals the second report in the same motion (height measured from the content, a grid-rows reveal for the second report, which is `inert` while closed). The button toggles `aria-expanded`/`aria-controls`, reads "Show less" with the chevron turned, is a 44px target and is operable by keyboard. Under reduced motion the change is instant.
- **Ruqyah Ayats / Duas** are ruled lists of `EntryDisclosure` rows (title in the display face; under it the citation, then the count chip). Opening a row shows Arabic, transliteration, translation, the practice line and the citation.

### Count label and unsourced label
- The count sits in the meta line as plain text, never a coloured badge: "Three times · Tirmidhi 3388" where a hadith gives the number, "Suggested: seven times" where it does not. In the one-card reader it is a hairline chip under the Arabic with the same wording.
- A dua with no graded source has no Arabic block. The transliteration takes the display face, and one muted line beneath reads "Not from a graded hadith. Scholars mention this dua." The citation badge and the Sources page say "No graded source"; the drawer explains in a sentence instead of showing an empty Arabic section.

### Citation badge and drawer
- Pill with grade and reference. Opens a bottom sheet on mobile and a 30rem right panel from 768px: Arabic, grade, grader, book, reference, chapter, exegetical note, link to `/sources#id`.

### Streak pill, week row, calendar
- **Pill:** hairline capsule, 56px tall; calendar button, then an accent book badge and the month count in the display face (`4/30`), with the current streak beside it. The count springs once when it changes (skipped under reduced motion).
- **Week row:** Monday to Sunday capsule of seven 40px circles; read days fill with the accent and a check, today carries a ring.
- **Calendar sheet:** the shared slide-over with a month grid; read days filled, today ringed, then current streak, best streak and days this month.

### Reader
- One verse at a time, in a rounded `--card` surface: surah menu button, title (`65. At-Talaq`, `3/12`, tap for the verse grid), bookmark; the Arabic centred at the reader's size with optional tajweed colours; share and `Aa` (settings) at the foot. Transliteration (large) and translation sit on the sky below. A "Juz N, X verses left" line sits above. Swipe, arrow keys or the buttons move between verses; the bottom bar holds previous, "I'm Done" (accent) and next, above the home indicator.
- Tajweed colours are painted over letter clusters of the exact Arabic; one lightness per sky (`--tjl`) keeps them readable on light and dark cards. Verse picker is a 5-column grid; the current verse is filled and verses read today carry a dot.

### Daily routine reader
- Morning, evening and bedtime sets open in the same frame as the Qur'an reader: "Routine · N left" above a `--card` surface with the card list button, the title and `3/7`, and a recited tick; the Arabic (tajweed colours where the card is a run of Qur'an verses), then share, citation badge and `Aa`. Transliteration is large under the card, then the translation, the repeat count and the source. The bottom bar is previous, "I'm Done" and next. Next (or a swipe) recites the card you leave; "I'm Done" recites the current card if it is finished and returns to Home, where the routine box shows its progress or "complete". Browsing by intent keeps the swipe deck.

### Chips
- Filter pills, 44px tall, filled ink when selected, hairline when not.

### Primary action
- Full-width accent block with a progress ring ("3 of 12 adhkar today").

## Do's and Don'ts

### Do
- Set every colour through the sky tokens.
- Keep Arabic exactly as sourced and render it instantly.
- Show a citation on every dua and mark drafts in Draft Amber.
- Respect `prefers-reduced-motion`: the lattice, haze, entrances, flip and drawer all stop.

### Don't
- Don't animate, transform or re-case Arabic.
- Don't use figures, crescent clip art, talismans or "energy" language.
- Don't put text on the lattice; it is texture only and fades before content.
- Don't introduce a fifth palette; a new mood is a new sky, not a new colour.

Not canonized: the persistent bottom "Draft" notices and the placeholder pages are build scaffolding, not system rules.

## Prayer times card (Home)

Lives inside the Home hero (`SkyHero` takes it as `children`): on a phone it follows the tiles, from 768px and on a landscape phone it sits under the sun's arc in the left column. 28px radius. It has its own sky, separate from the page's four-sky theme: each prayer has a top/bottom colour pair (`src/lib/daylight.ts`: Fajr indigo-amethyst, Sunrise morning blue over burnt apricot, Dhuhr clear blue, Asr blue easing to amber, Maghrib plum over ember, Isha deep indigo) and the card blends in OKLab from the pair of the prayer now running to the next as minutes pass, so the gradient is the sun's place in the day. Every pair stays dark enough for the warm-white ink; `npx tsx scripts/check-daylight.mts` samples every blend and fails below 4.5:1. Before a location exists it follows nominal clock hours. Content: current prayer in the display face with its time right-aligned (tabular), a 6px progress track in the ink colour, and one line "Next in 2 h 14 min". An `sr-only` h2 names the section. No location: one privacy sentence and a full-width warm-white button. Updates every 20 s and on focus/visibility.

**All times panel.** Holding the card for 450 ms (moving more than 10px, lifting, or scrolling cancels; the card leans in to 98.5% while the hold counts) or right-clicking it opens `PrayerDaySheet` in the app's `Sheet`: six rows, the display face for the prayers and a smaller face for Sunrise (a marker, not a prayer), passed times softened, the running prayer on an accent-tinted pill with "Now", the next with "Next, in 2 h 28 min", then the method and Asr school and a link to Settings. After Isha a muted Fajr row for tomorrow is added. The card keeps iOS from selecting text or showing its callout (`select-none`, `-webkit-touch-callout: none`). Long-press is invisible, so a bordered "All times" pill (44px hit area) sits opposite the countdown; it is the keyboard and VoiceOver route. `npx tsx scripts/check-prayer-day.mts` checks the row logic.

## Night mode

An explicit override of "nothing else knows the hour": one switch pins the page to the `night` token set (`data-sky="night"`, the status-bar colour `#060b22`, `color-scheme: dark`) until it is turned off, and the real sky resumes immediately when it is. `src/lib/night.ts` owns the flag (`rp:v1:night`) and `applySky()`; the pre-paint script in `layout.tsx` and `SkyClock` read the same key, and a `?sky=` preview still wins. Turning it on or off crossfades the page through a view transition (instant under reduced motion). The Home hero and the prayer card are deliberately untouched: the sun stays on the arc on the dark sky with the night orb tokens (cream disc, cool glow), and the prayer card keeps the true sky of the running prayer. The control is `NightButton` in the header, a 44px round button: outlined while off, accent-tinted with the same glyph while on (never a bright pill on a dark page). The mark is a ring with its right half filled (`HalfDisc`), not a crescent, in keeping with the no-crescent rule. Settings carries the same switch as a row with one line of explanation.

## Add to Home Screen offer

`InstallPrompt` (src/components/InstallPrompt.tsx) sits at the top of Home, above the hero, only while the app is not installed and not dismissed: a glass card with the mark in a ring, one display-face sentence ("Keep RuqyaPro on your Home Screen"; "Install RuqyaPro on this computer"; "Keep RuqyaPro in your Dock"), one plain line, a full-width primary button and a quiet "Not now" underneath. Where the browser has its own install dialog the button opens it; elsewhere it opens a `Sheet` with three numbered steps, each with a drawn glyph (`ShareMark`, `AddSquare`), a short instruction in the lead size and one line of help, plus a pill with a bobbing arrow toward the browser's toolbar (down on iPhone, up on iPad, Mac and Android; the bob stops under reduced motion). Device detection is `src/lib/install-platform.ts`, tested against real user-agent strings by `scripts/check-install.mts`. The browser's install event is caught in the pre-paint script in layout.tsx so it is not missed. `InstallRow` repeats the offer in Settings.

## Account (Settings)

A section just above "Your progress", with its own jump chip (`#account-title`). Signed out: a two-way pill (Sign in / Create account), a username field, a password field and, only when creating, an invite code field, one full-width primary button, and the plain privacy paragraph beneath. Fields are native `.field` pills with `autocomplete` set (`username`, `current-password` / `new-password`) inside a real `<form>` so iPhone and Mac Safari offer to save and fill the password. Signed in: a glass card ("Signed in as ayesha", "Last synced Oct 2, 7:38 PM") with Sync now, Sign out and Delete account (a second, inline confirm; no modal). Messages are one calm sentence each, in `role=alert` while signing in and `role=status` once signed in. Merge rules and tests: `src/lib/account-merge.ts`, `scripts/check-account-merge.mts`.

## Reminders (Settings)

A section after Prayer times, reached by its own jump chip (`#reminders-title`). One switch ("Reminders") with a plain privacy paragraph beneath it; only when it is on do the groups appear: Prayers (five switches and a "When" select: At the time / 5 / 10 / 15 / 30 minutes before), Adhkar (a switch and a native time field per row, with Friday's Al-Kahf in the same list), Verses (a switch, then two time fields), then a status line ("Reminders are set until 15 November"), "Send a test" and "Turn off and delete". Rows reuse the Reading settings' ruled rows and native switches; time fields are `.field` pills at 44px. Blocked states are one sentence of prose above the switch (not on the Home Screen yet, notifications refused, browser unsupported) and the switch is disabled. A notification is title plus one line, calm and plain ("Asr" / "It is time for Asr."; "Morning adhkar" / "A few minutes of remembrance."; a verse is its reference as the title and its translation as the body). `public/reminders-sw.js` decides what to show; the checks are `scripts/check-reminders.mts` and `scripts/check-sw-push.mts`.

## Responsive behaviour

- **Small phones (320px):** tab labels are `nowrap` with a fluid size (`clamp(0.62rem, 2.9vw, 0.72rem)`); the tab bar is 86% opaque so lists scrolling under it never show through the labels. The phone header carries a Search button (44px, outlined) on the right.
- **Loading:** the reader shows a `.skeleton` in the verse card's shape instead of text, so nothing jumps when the verse arrives. The footer is hidden on reading screens below 1024px.
- **Landscape phone** (`short:` variant = `max-height: 500px` and landscape): the header scrolls away instead of sticking, the tab bar shrinks to 44px icons, Home shows a small sky beside the headline and tiles, and both readers go two columns (verse card left, transliteration and translation right, each scrolling) with a compact bottom bar.
- **Tablets (768 to 1023px):** Home keeps the tab bar but goes two columns: sky and prayer card left, headline and tiles right (the headline scales with `5.4vw`, about three lines at 820px), and the four topics in two columns. The `compact` variant (`max-height: 720px`, portrait) trims the first screen on short phones: smaller headline floor, tighter gaps. The sun's arc is cropped to `0 28 400 122` so it takes less height.
- **Large text and touch:** the app is built in rem, so a larger browser text size scales it; grids use `minmax(0, 1fr)` and text columns `min-w-0` so nothing widens past the screen, and rows that hold a button next to text (the install hint) stack below 420px. Every control is 44px tall at least (inline links in a sentence excepted).
- **Wide screens (1024px and up):** the Qur'an uses a two-pane layout (`src/app/quran/layout.tsx`): the surah list (Juz, Chapter, Bookmarks, search, verse picker) stays on the left; the Qur'an page or the reader fills the right. The reader's action bar is `sticky` inside its column so it lines up with the card. Arabic text is 2.2rem at scale 1 (1.9rem below 1024px).
- **Speed:** the moving sky layers have no blur filter (the radial gradients already fade out) and pause while the app is in the background; long lists use `.glass-lite` (no backdrop blur) and `content-visibility: auto` (`.cv-auto`, `.cv-auto-card`).

## Transliteration guide panel

`TranslitGuideRow` (src/components/TranslitGuide.tsx) is a full-width row in the Reading settings (the Aa sheet in both readers, and the Reading section of the Settings tab). It opens a `Sheet` (bottom sheet on phones, right panel from 768px) called "Reading the transliteration". Sections, each divided by a hairline: Plain letters, Underlined (say with care), Faded (written, not said), Faded at the end of a verse, a list pairing each underlined consonant with its Arabic letter, a quick key (AA, oo/ee, doubled letters, kh/gh/sh) and a one-line note to learn from a teacher. Its examples are drawn with `MARK_UNDERLINE` and `MARK_SILENT` exported from `Translit.tsx`, the same styles the verses use, at 1.45rem, each with an `aria-label` that spells the marks out.
