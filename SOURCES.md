# SOURCES

Every dataset the content pipeline uses, with the exact version pinned. `scripts/import-content.mts` fetches from these and nothing else.

| Use | Source | Version / license |
| --- | --- | --- |
| Quranic Arabic (Uthmani), Saheeh International translation, transliteration | Quran.com API v4, `verses/by_key` (`text_uthmani`), translation resource 20, transliteration resource 57 | Retrieved 2026-09-30. Terms: https://quran.com and https://api-docs.quran.com. The transliteration is in the Tanzil scheme (for example `aAA` for the letter ayn); replace it if a friendlier cited source is preferred. |
| Hadith Arabic, English, chapter names and gradings | `fawazahmed0/hadith-api`, editions `ara-*` and `eng-*` for bukhari, muslim, abudawud, tirmidhi | https://github.com/fawazahmed0/hadith-api, commit `df57907be35291c91ad6a6691180e22ca9920784`, license: The Unlicense |
| Transliteration for morning/evening and sleep duas | `fitrahive/dua-dhikr` (`evening-dhikr`, `daily-dua`) | https://github.com/fitrahive/dua-dhikr, commit `f42f895f914319a844c3e3c2279483cae060ea19`, license: MIT |
| Transliteration embedded in English hadith text (pain dua, children's refuge) | The English translators' text in `eng-muslim` and `eng-tirmidhi` of the dataset above | As above |

## How Arabic is handled

- Quranic Arabic is stored exactly as returned by the API. Some verses begin with a space in the source; it is kept.
- Hadith duas are cut out of the dataset's Arabic text between plain-letter anchors, and the slice is returned byte for byte, with the dataset's tashkeel. The script fails if an anchor is not found.
- Nothing is typed, corrected or normalised by hand.

## Hadith numbering

Hadith are cited by the book-wide number that sunnah.com uses (`arabicnumber` in the dataset). For example the Jibril ruqyah is **Sahih Muslim 2186**, Book 39. The brief's wording "Book 39, Hadith 2186" mixes the book number with this number; the dataset's in-book number for it is 54.

## Not yet cross-checked

- Hadith text and grades against sunnah.com and Dorar.net (the dataset carries Albani, Arna'ut and other gradings for Abu Dawud and Tirmidhi; Bukhari and Muslim carry none, and are cited as Sahihayn).
- Quranic Arabic against Tanzil. One byte-level difference exists between Quran.com and `fitrahive/dua-dhikr` for Ayat al-Kursi, recorded in `MISSING.md`.

## What the screenshots in `content/` contributed

- **Ayat list (IMG_2038 to IMG_2040):** the list of surah and verse numbers only. Seven passages (Al-Baqarah 1-12, 102, 163-164; Al-A'raf 54-56; As-Saffat 1-10; Al-Hashr 21-24; At-Talaq 2-3) are on Self-Ruqyah, with Arabic from Quran.com. The screenshots end at As-Saffat 10.
- **Dua images (IMG_2010 to IMG_2036):** the verse or hadith reference printed on each. Eleven single verses (Quran.com), plus three duas whose hadith references were matched in the dataset: Bukhari 7383, Muslim 2730 (with Bukhari 6346), Abu Dawud 5090. Titles, counts, day-lengths and claims from the images were not used.
- **Included with title and count only (dua-034 to dua-040), since replaced:** the screenshots' titles ("Punishing the Enemy", "Joint Magic", "Stomach Magic", "Black Magic Face"...) and counts had no cited source. On 2026-10-03 the counts were dropped, and dua-037, -039 and -040 (duplicates of Al-Anbiya 21:69, Al-Hadid 57:3 and Abu Dawud 5090) were removed as separate entries. The owner then asked for the titles back: dua-034 "Ruqyah for Punishing the Enemy" (111:1-5), dua-035 "Ruqyah for Joint Magic" (3:54), dua-036 "Destroy Stomach Magic" (4:10), dua-038 "Black Magic Face Ruqyah" (75:22), and the two duplicates' titles on the plain verses dua-028 "Ruqyah for Body Burning" (21:69) and dua-024 "Destroy Waswasah With Ruqyah" (57:3). These are the owner's titles, not from a cited source (each entry's "Where each text came from" says so), and the app does not claim a verse does what its title says. The Arabic, translation and transliteration of these passages are the Qur'an text as for every other verse. The method text (knife, salt, oil, water, cotton, number of days, medical claims) was never carried over.
- **Not included:** "Jinn Expulsion Shield". Its Arabic cannot be taken from a cited text; the formula was not found in the pinned dataset and the reference on the image does not match. See `MISSING.md`.

## Transliteration of the duas

- **Qur'anic entries:** Tanzil `en.transliteration` (see "Transliteration update" below), in the Tanzil scheme (for example `AA` for the letter ayn).
- **Abu Dawud 5090 (dua-033, dua-040):** `fitrahive/dua-dhikr` morning-dhikr, first three requests only; its Arabic matches the Abu Dawud text after normalisation.
- **Pain dua (dua-008) and children's refuge (dua-009):** the translators' transliteration inside the English hadith text.
- **Jibril ruqyah (dua-007), Seeking refuge in Allah's might (dua-031), At a time of distress (dua-032):** no cited repo carries these. The Latin transliteration printed on the owner's images (IMG_2025, IMG_2026, IMG_2029) was used, read by eye. The owner should check it against the images.

## The recitation library and Self-Ruqyah lists (2026-10-03)

The owner supplied the five Recitations sections and the three Self-Ruqyah sections as a list (titles, order, counts, and a transliteration for most duas). They are stored in `data/library.json`; `scripts/check-library.mts` keeps the owner's lists as a fixture and fails if the data drifts from them.

- **Qur'anic items** (18:1-10, 21:83, 21:87, 23:115-118, 38:35, 9:129, 3:173 and Surah Ar-Rahman 55:1-78, plus every passage already there): Arabic from Quran.com API v4 `text_uthmani`, translation Saheeh International, transliteration Tanzil, retrieved 2026-10-03, exactly as for the rest of the Qur'an. The owner's own transliteration of 21:83 ("Rabbi inni massaniya...") differs from the verse's wording ("anni massaniya"), so the verse as sourced is shown.
- **New hadith duas** (Protection From Evil, Evil Eye, Visiting a Sick Person, Healing, Money, Debt, Protection from Debt and Anxiety, Durood-e-Ibrahim): Arabic cut verbatim from the pinned hadith dataset (`fawazahmed0/hadith-api`, commit `df57907b…`) between plain-letter anchors, English and grade from the same dataset. References: Muslim 2709, Bukhari 3371, Abu Dawud 3106, Bukhari 5743, Bukhari 6334 (also Tirmidhi 3829), Tirmidhi 3563 (Hasan), Bukhari 6369, Bukhari 3370. The owner's first-person Evil Eye wording is in Bukhari 3371. The Money dua is the narrated third-person wording, as the owner chose; it and Durood-e-Ibrahim have no transliteration until the owner supplies one.
- **Ruqyah Duas, last two (added back 2026-10-03):** "Seeking refuge in Allah's might" (Bukhari 7383) and "Dua for Extreme Distress" (Muslim 2730, with Bukhari 6346); their text, grade and transliteration are as described under "Transliteration of the duas" above. The owner gave them no count.
- **Dua for Worry (Ya Hayyu ya Qayyum):** Arabic and English from `fitrahive/dua-dhikr` (MIT), whose own note cites an-Nasa'i, 'Amal al-Yawm wal-Layla 575 (Hasan, per that note). The owner's transliteration omits "abadan" after "tarfata 'ayn" in the dataset's wording.
- **Transliteration of the new duas:** supplied by the owner on 2026-10-03, spelling as typed, not from a cited repo; the owner should check it. Existing duas keep the transliteration they had.
- **Counts:** each count the owner listed is shown. The label names the hadith that gives the number where the pinned English text states it (for example Ikhlas, Falaq and Nas three times, Abu Dawud 5082; Protection From Harm three times, Tirmidhi 3388; Pain dua, Muslim 2202; Good Health, Abu Dawud 5090), found by the import script and checked again by `scripts/check-library.mts --online`. Where it does not, the card says "Suggested". "Hasbiya Allah" seven times rests on Abu Dawud 5081, which Al-Albani grades Mawdu, so it is shown as "Suggested" with no hadith cited.
- **Three duas with no source** (Dua for Halal Riqz, Dua for Blessings in Provision, Dua for Depression): kept at the owner's request. The pinned hadith dataset (Bukhari, Muslim, Abu Dawud, Tirmidhi, Ibn Majah, Nasa'i, Malik, Nawawi, Qudsi), `fitrahive/dua-dhikr` and an open Hisn al-Muslim dataset were searched and no Arabic was found. All three show the owner's transliteration, are labelled "Not from a graded hadith. Scholars mention this dua.", and can never be marked verified. On 2026-10-03 the owner sent an image of "Dua for Halal Money" and Dua for Halal Riqz now also shows the Arabic and the English line printed on it. I read the Arabic from the image at high zoom, mark by mark (the final yaa of the third word is drawn dotless and no kasra is drawn under its nun, and both are kept as drawn); it is not from a cited text, and the owner should check it against the image. This is an explicit exception to the earlier rule against transcribing Arabic from the owner's images, made because the owner asked for it and the entry stays labelled and unverified. Blessings in Provision and Depression remain transliteration-only.
- **Preparation:** Bukhari 1 (actions by intentions), Qur'an 66:8 (sincere repentance), Abu Dawud 3883 (the Prophet's words that spells, amulets and love charms are polytheism, Sahih in the dataset), Bukhari 3370 (Durood-e-Ibrahim). Wudu has no citation because none was found in the data; it is shown as plain guidance.

## The Qur'an reader (`/quran`)

- **Arabic:** Quran.com API v4 `quran/verses/uthmani`, stored exactly as returned, retrieved 2026-09-30. **Translation:** Saheeh International, Quran.com resource 20. **Transliteration:** now Tanzil's original `en.transliteration` (see "Transliteration update" below; earlier builds used Quran.com resource 57). **Chapter names, verse counts, juz ranges:** Quran.com `chapters` and `juzs` (the API lists every juz twice; duplicates are dropped).
- **Second-source check:** every one of the 6,236 verses was compared, letters only (diacritics and hamza carriers ignored), with the King Fahd Complex Uthmani Hafs text in `fawazahmed0/quran-api` (commit `47ca096b0976443ba2eab2e45cdf0fb4096a2610`, Unlicense). All verses agree. Diacritics are not compared because the two sources encode them differently.
- **Files:** `public/quran-data/v1/{1..114}.json` and `data/quran/chapters.json`, built by `scripts/import-quran.mts` and checked by `scripts/validate-quran.mts` on every build.
- **Still to confirm before wide release:** the reuse terms of the Quran.com API and the Tanzil-derived text (attribution is shown in the reader).
- **Data on the reader's device only:** last place, reading days, verses seen today, bookmarks, saved surahs and display choices, under `rp:v1:quran:*` in local storage; saved surahs in Cache Storage `rp-quran-v1`.

## Tajweed colours

- From Quran.com API v4 `uthmani_tajweed`. That text uses its own code points (for example U+0672 and U+066E) and one verse has a broken tag, so it is **never displayed**. Its tags are only used to colour letter clusters of the exact Arabic above, stored as ranges (`tg`) in `public/quran-data/v2/`. A verse is coloured only when its letters line up exactly with the plain text: 5,968 of 6,236 verses are coloured, 268 show in plain colour.
- The colour legend names come from the source's class names; have a scholar check them before wide release.
- Data version is now `v2` (path `/quran-data/v2/`, cache `rp-quran-v2`). Saved-surah records carry the version, so a bump starts clean.

## Transliteration update (data v3)

- **Source:** Tanzil's original English transliteration, as packaged in `risan/quran-json` npm 3.1.2 (`dist/quran_transliteration.json`). Tanzil licence: attribution, text unmodified; the package is CC-BY-4.0 on npm and CC-BY-SA-4.0 on GitHub, so check the share-alike wording before wide release. Attribution is shown in the app.
- **Why:** Quran.com's resource 57, used before, joined neighbouring words ("yahtasibuwaman", "hasbuhuinna"), dropped some letters ("ajra" for "ajran") and left stray hyphens. Tanzil's text is spaced word for word, and every one of the 6,236 verses has it.
- **Underlines:** two kinds, both worked out mechanically by `scripts/lib/translit-marks.mts` and stored as ranges (`tu`); the Latin letters are never changed.
  - *Letters with more than one sound.* Tanzil's text writes ث ذ ظ all as "th", ح ه as "h", س ص as "s", د ض as "d" and ت ط as "t". The Latin letters that stand for the heavy letter (ذ ظ, ح, ص, ض, ط) are underlined.
  - *Long ā.* A long ā (alif, dagger alef, alif maqsura, the ā of Allah) is written "a" in Tanzil's text and is underlined, as in the reference reader (Allah, ala, hatta, ya). A long ū ("oo") and a long ī ("ee") are not underlined: the reference reader leaves them plain (v6 removed them). A tanween alif is said long only where the verse stops: there the "a" is underlined and the "n" is silent (nukran, stored in `ts`); inside a verse it is the short "an" and is left plain.
  - *How:* Arabic and Latin words are matched in order; shadda-doubled letters match doubled Latin letters; Arabic vowel signs are matched to Latin vowels one by one. A word that does not match cleanly is left plain. 6,101 of 6,236 verses carry at least one underline. On At-Talaq 65:4 to 65:8 the underlines match the reference reader letter for letter. Tanzil's Latin splits a vocative ya into its own word, writes some short u as o (olaika, okhra) and gives a hamzat wasl the vowel it starts with (ittaqoo); the matcher accepts all of those, so about 77,000 of 77,100 words now match (v5 matched about 70,300). `npx tsx scripts/diag-translit.mts` lists the words still left plain.
  - *Where:* the Qur'an reader, routine cards, the deck, the reader pages and Self-Ruqyah, for every Qur'an text. Hadith duas use other transliteration sources and schemes, so they show plain text. Have a teacher confirm which letters should be marked.
- **Silent letters** (stored as `ts`, shown bold and faded): the hamzat wasl, the alif of "al-", "ibn" and so on, which is not said when a word is joined to the one before it (so the "a" of "alhayyu" in "huwa alhayyu", the "A" of "Allahi" in "bismi Allahi"), and the lam of "al-" before a sun letter, which is never said (the "l" of "alssamawati"). A word that starts a verse, or follows a waqf sign, is said from its alif and is left plain. Worked out mechanically from the Arabic text, word by word, and only where the Arabic and Latin words match. A teacher should confirm the rule.
- Data moved to `/quran-data/v6/` (v3 added the Tanzil text, v4 the underline ranges, v5 the silent letters, v6 the rules above) and cache `rp-quran-v6`; saved surahs from older versions are cleared and can be saved again.

## Prayer times

Calculated on the device with the `adhan` library (MIT, https://github.com/batoulapps/adhan-js), using the published angle conventions of each method (Muslim World League, ISNA, Egyptian, Karachi, Umm al-Qura, Dubai, Kuwait, Qatar, Singapore, Diyanet, Tehran, Moonsighting Committee), the recommended high-latitude rule, and Standard or Hanafi Asr. No network request is made. Times can differ by minutes from a local mosque's timetable; the app says so in Settings. Owner to confirm which method should be the default for the intended audience.
