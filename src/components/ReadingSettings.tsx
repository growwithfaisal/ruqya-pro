"use client";
import { setPrefs, useQuran } from "@/lib/quran-store";
import { ArabicSizeControl } from "./ArabicSizeControl";
import { TranslitSizeControl } from "./TranslitSizeControl";
import { TranslitGuideRow } from "./TranslitGuide";

/** How the Qur'an, the routines and the ayah of the day are shown. */
export function ReadingSettings() {
  const q = useQuran();

  return (
    <section aria-labelledby="reading-title">
      <h2 id="reading-title" className="t-h2">Reading</h2>
      <p className="mt-2 text-ink-soft">These apply to the Qur&apos;an, the routines and the ayah of the day.</p>
      <div className="mt-4 border-t border-line">
        {([["translit", "Transliteration"], ["translation", "Translation (Saheeh International)"], ["tajweed", "Tajweed colours"]] as const).map(([k, label]) => (
          <label key={k} className="flex min-h-14 items-center justify-between border-b border-line">
            <span>{label}</span>
            <input type="checkbox" role="switch" checked={q.prefs[k]} onChange={(ev) => setPrefs({ [k]: ev.target.checked })} className="size-6 accent-[var(--accent)]" />
          </label>
        ))}
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-2">
          <span>Arabic size</span>
          <ArabicSizeControl />
        </div>
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-2">
          <span>Transliteration size</span>
          <TranslitSizeControl />
        </div>
        <TranslitGuideRow />
      </div>
    </section>
  );
}
