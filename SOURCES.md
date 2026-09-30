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
- **Included with title and count only (dua-034 to dua-040):** Punishing the Enemy (Al-Masad 111:1-5), Joint Magic (Ali 'Imran 3:54), Stomach Magic (An-Nisa 4:10), Body Burning (Al-Anbiya 21:69), Black Magic Face (Al-Qiyamah 75:22), Waswasah (Al-Hadid 57:3) and Black Magic (Abu Dawud 5090). Arabic and translation come from the cited datasets. The method text (knife, salt, oil, water, cotton, number of days, medical claims) was not carried over. The counts and titles have no cited source.
- **Not included:** "Jinn Expulsion Shield". Its Arabic cannot be taken from a cited text; the formula was not found in the pinned dataset and the reference on the image does not match. See `MISSING.md`.

## Transliteration of the duas

- **Qur'anic entries:** Quran.com resource 57, in the Tanzil scheme (for example `aAA` for the letter ayn).
- **Abu Dawud 5090 (dua-033, dua-040):** `fitrahive/dua-dhikr` morning-dhikr, first three requests only; its Arabic matches the Abu Dawud text after normalisation.
- **Pain dua (dua-008) and children's refuge (dua-009):** the translators' transliteration inside the English hadith text.
- **Jibril ruqyah (dua-007), Seeking refuge in Allah's might (dua-031), At a time of distress (dua-032):** no cited repo carries these. The Latin transliteration printed on the owner's images (IMG_2025, IMG_2026, IMG_2029) was used, read by eye. The owner should check it against the images.

## The Qur'an reader (`/quran`)

- **Arabic:** Quran.com API v4 `quran/verses/uthmani`, stored exactly as returned, retrieved 2026-09-30. **Translation:** Saheeh International, Quran.com resource 20. **Transliteration:** Quran.com resource 57 (Tanzil scheme). **Chapter names, verse counts, juz ranges:** Quran.com `chapters` and `juzs` (the API lists every juz twice; duplicates are dropped).
- **Second-source check:** every one of the 6,236 verses was compared, letters only (diacritics and hamza carriers ignored), with the King Fahd Complex Uthmani Hafs text in `fawazahmed0/quran-api` (commit `47ca096b0976443ba2eab2e45cdf0fb4096a2610`, Unlicense). All verses agree. Diacritics are not compared because the two sources encode them differently.
- **Files:** `public/quran-data/v1/{1..114}.json` and `data/quran/chapters.json`, built by `scripts/import-quran.mts` and checked by `scripts/validate-quran.mts` on every build.
- **Still to confirm before wide release:** the reuse terms of the Quran.com API and the Tanzil-derived text (attribution is shown in the reader).
- **Data on the reader's device only:** last place, reading days, verses seen today, bookmarks, saved surahs and display choices, under `rp:v1:quran:*` in local storage; saved surahs in Cache Storage `rp-quran-v1`.
