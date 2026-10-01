"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ayahOfTheDay, chapter, loadSurah, readHref, type Verse } from "@/lib/quran";
import { useQuran } from "@/lib/quran-store";
import { Coloured } from "./Coloured";
import { Translit } from "./Translit";
import { Chevron } from "./Glyphs";

/** One verse a day, chosen from the whole Qur'an by the device's own date. It changes at local midnight. */
export function AyahOfTheDay() {
  const q = useQuran();
  const pick = useMemo(() => ayahOfTheDay(q.today), [q.today]);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setVerse(null);
    setFailed(false);
    loadSurah(pick.surah).then((all) => live && setVerse(all[pick.verse - 1])).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [pick.surah, pick.verse]);

  const c = chapter(pick.surah);
  const lead = verse ? verse.ar.length - verse.ar.trimStart().length : 0;

  return (
    <section aria-labelledby="ayah-title" className="mx-auto max-w-5xl px-4 pt-14 md:px-8 md:pt-20">
      <div className="mx-auto max-w-2xl">
        <h2 id="ayah-title" className="display text-center text-[clamp(1.8rem,5vw,2.5rem)] leading-tight">Ayah of the day</h2>
        <p className="mt-1 text-center text-[0.95rem] text-ink-soft">
          {c.name} <span className="tabular">{pick.surah}:{pick.verse}</span>
        </p>

        <div className="mt-5 min-h-[18rem] rounded-[28px] border border-line bg-card px-5 py-7 text-card-ink shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]">
          {failed && (
            <p className="py-10 text-center text-card-soft" role="status">
              Today&apos;s ayah is not on this device yet. Connect once, or open it in the Qur&apos;an reader.
            </p>
          )}
          {!verse && !failed && <p className="py-10 text-center text-card-soft" role="status">Opening today&apos;s ayah…</p>}
          {verse && (
            <>
              <p lang="ar" dir="rtl" className="arabic arabic-read !text-center">
                {q.prefs.tajweed && verse.tg ? <Coloured ar={verse.ar.trim()} ranges={verse.tg} lead={lead} /> : verse.ar.trim()}
              </p>
              {q.prefs.translit && (
                <p className="mt-5 text-center text-[clamp(1.15rem,4.2vw,1.4rem)] leading-snug">
                  <Translit text={verse.tr} marks={verse.tu} silent={verse.ts} />
                </p>
              )}
              {q.prefs.translation && (
                <p className="mx-auto mt-4 max-w-[60ch] text-center text-[1.02rem] leading-relaxed text-card-soft">{verse.en}</p>
              )}
            </>
          )}
        </div>

        <Link
          href={readHref(pick.surah, pick.verse)}
          className="group mt-4 flex min-h-14 items-center justify-between rounded-full border border-line px-5 no-underline"
        >
          <span>Read {c.name} from this verse</span>
          <Chevron className="text-ink-soft transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
