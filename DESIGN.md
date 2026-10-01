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
- **Headline** (400, clamp(1.8rem, 5vw, 2.5rem), 1.1): page and section titles.
- **Title** (400, 1.35 to 1.5rem): card and entry titles.
- **Body** (400, 1rem, 1.6): copy, capped near 65ch.
- **Arabic** (400, 1.9rem at scale 1, 2.15): centred, RTL, `lang="ar"`.

### Named Rules
**The Steady Text Rule.** No fade, scramble, typewriter or transform on Arabic. Animate the card, never the words.

## Layout

Mobile-first single column with a 16px gutter, `max-w-5xl` container, two columns from 768px on Home (hero and intents). Sections are separated by generous space and hairline rules, not boxes. The inline navigation appears from 1024px; below that a Menu button opens a bottom sheet. Rows are at least 44px tall; primary controls 48px or more.

## Elevation & Depth

A light touch of frosted glass sits over the tonal layering: cards (`.glass`, 72% of the card colour, 16px blur), sheets and the menu (`.glass-strong`, 88%, 24px), the sticky header (`.glass-bar`, 64% of the sky top, 16px) and a few pills and the search field (`.glass-chip`, 42%, 10px), each with a soft diagonal sheen. The drifting sky and lattice show faintly through while text keeps its contrast. The swipe deck keeps solid faces, because backdrop blur would flatten its 3D flip. Every glass surface becomes solid where blur is unavailable or `prefers-reduced-transparency` is set.

Tonal layering with two soft shadows. The recitation card has one offset, wide-blur shadow (`0 24px 48px -20px rgb(0 0 0 / 0.35)`); drawers use an upward version. Cards behind the top card are the same shape at 60% and 30% opacity, shifted down, to suggest a deck.

## Shapes

The signature silhouette is the arch niche: `border-radius: 50% 50% 28px 28px / 150px 150px 28px 28px`. Controls are full pills; drawers have 28px top corners. Hairlines are 1px `--line`.

## Components

### Recitation card
- **Shape:** arch niche, `--card` surface, `--card-ink` text.
- **Front:** title, grade tag, Arabic (scrolls inside), transliteration, translation, citation badge, "Mark as recited", "Read in full".
- **Back (tap or Details):** practice, repeat count, source, grader, draft notice.
- **Motion:** spring swipe with a 90px or 500px/s threshold; a 3D flip; instant under reduced motion.

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

Sits between the topic rows and the Ayah of the day, same width as the ayah card (`max-w-2xl`), `.glass` at the 28px radius. Content: current prayer in the display face with its time right-aligned in tabular figures, a 6px progress track in `--accent` (elapsed share of the gap to the next prayer), and one line of "Next in 2 h 14 min". No heading is drawn (an `sr-only` h2 names it). Before a location exists it shows one sentence about privacy and a full-width accent button. Updates every 20 s and on focus/visibility.
