"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ayahOfTheDay, chapter, loadSurah, readHref, type Verse } from "@/lib/quran";
import { useQuran } from "@/lib/quran-store";
import { Chevron } from "./Glyphs";

/**
 * One verse a day, chosen from the whole Qur'an by the device's own date. It changes at local midnight.
 * The card shows the translation only (Saheeh International); the Arabic is one tap away in the reader.
 */
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

  return (
    <section aria-labelledby="ayah-title" className="mx-auto max-w-5xl px-4 pt-14 md:px-8 md:pt-20">
      <div className="mx-auto max-w-2xl">
        <h2 id="ayah-title" className="t-h2-lead text-center">Ayah of the day</h2>
        <p className="mt-1 text-center text-small text-ink-soft">
          {c.name} <span className="tabular">{pick.surah}:{pick.verse}</span>
        </p>

        <figure className="mt-5 grid min-h-[11rem] place-content-center glass rounded-[28px] border border-line px-6 py-8 text-center text-card-ink shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]">
          {failed && (
            <p className="text-card-soft" role="status">
              Today&apos;s ayah is not on this device yet. Connect once, or open it in the Qur&apos;an reader.
            </p>
          )}
          {!verse && !failed && (
            <div role="status" aria-label="Opening today's ayah" className="grid gap-3">
              <div className="skeleton mx-auto h-4 w-4/5 !rounded-full" aria-hidden />
              <div className="skeleton mx-auto h-4 w-3/5 !rounded-full" aria-hidden />
            </div>
          )}
          {verse && (
            <>
              <blockquote className="mx-auto max-w-[34ch] text-[clamp(1.2rem,4.6vw,1.5rem)] leading-snug text-balance">{verse.en}</blockquote>
              <figcaption className="mt-4 text-meta text-card-soft">Saheeh International</figcaption>
            </>
          )}
        </figure>

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
