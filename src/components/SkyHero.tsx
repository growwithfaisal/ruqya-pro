"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { arcProgress, decimalHour, isFriday, setForHour, SKY_LABEL, type Sky } from "@/lib/sky";
import { liveSky } from "@/lib/sky-live";
import { prayerNow, usePrayerState } from "@/lib/prayer";
import { doneKey, useDone } from "@/lib/progress";
import { chapter, readHref } from "@/lib/quran";
import { useQuran } from "@/lib/quran-store";
import { SETS } from "@/lib/entries";
import type { TimeTag } from "@/lib/types";
import { Check, Chevron } from "./Glyphs";

const LINE: Record<Sky, string> = {
  dawn: "Begin the day with remembrance.",
  day: "A quiet moment, whenever you need one.",
  dusk: "Close the day with remembrance.",
  night: "Settle the night with remembrance.",
};

// Quadratic arc across a 400x150 box.
const P0 = [24, 138], C = [200, -46], P2 = [376, 138];
const at = (t: number) => [
  (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * C[0] + t ** 2 * P2[0],
  (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * C[1] + t ** 2 * P2[1],
];

export function SkyHero({ setIds }: { setIds: Record<TimeTag, string[]> }) {
  const [now, setNow] = useState<Date | null>(null);
  const [previewSky, setPreviewSky] = useState<string | null>(null); // set after mount so the first render matches the server
  const { done } = useDone();
  const quran = useQuran();

  useEffect(() => {
    const tick = () => setNow(new Date());
    setPreviewSky(new URLSearchParams(location.search).get("sky"));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const { place, prefs } = usePrayerState();
  const h = now ? decimalHour(now) : 9;
  // ?sky= previews a sky at a representative hour; otherwise the sun's place comes from the real sunrise and sunset when known.
  const previewing = !!previewSky && previewSky in SKY_LABEL;
  const live = now ? liveSky(now, { place, prefs }) : null;
  const sky: Sky = previewing ? (previewSky as Sky) : live?.sky ?? "day";
  const shown = previewing ? { dawn: 6.5, day: 12, dusk: 18, night: 22 }[sky] : h;
  const { body, t } = previewing || !live ? arcProgress(shown) : live;
  const [x, y] = at(t);
  const set: TimeTag = setForHour(shown);
  const friday = !!now && isFriday(now);
  const kahf = chapter(18);
  const kahfAt = quran.last?.surah === 18 ? quran.last.verse : 1;
  const kahfSeen = quran.seen.keys.filter((k) => k.startsWith("18:")).length;
  const kahfDone = kahfSeen >= kahf.verses;
  // The Waqi'ah reminder shows from Maghrib until Fajr: by the real prayer times when a place is saved, else from 18:30 to 05:00.
  const pn = place && now && !previewing ? prayerNow(place, prefs, now) : null;
  const afterMaghrib = previewing ? sky === "night" : pn ? pn.current.name === "Maghrib" || pn.current.name === "Isha" : !!now && (h >= 18.5 || h < 5);
  const waqiah = chapter(56);
  const waqiahAt = quran.last?.surah === 56 ? quran.last.verse : 1;
  const waqiahSeen = quran.seen.keys.filter((k) => k.startsWith("56:")).length;
  const waqiahDone = waqiahSeen >= waqiah.verses;
  const ids = setIds[set];
  const ready = !!now; // before the device clock is read the tile is neutral, so a wrong routine never flashes as complete
  const count = ready ? ids.filter((i) => done.has(doneKey(set, i))).length : 0;
  const total = ids.length;
  const setDone = ready && total > 0 && count >= total;

  return (
    <section aria-labelledby="hero-line" className="mx-auto max-w-5xl px-4 pt-8 short:pt-3 md:px-8 md:pt-14">
      <div className="grid items-end gap-6 short:grid-cols-[1fr_1.25fr] short:items-center short:gap-8 md:grid-cols-[1.15fr_1fr] md:gap-12">
        <div className="relative">
          <svg viewBox="0 0 400 150" className="w-full overflow-visible short:max-h-28" role="img" aria-label={now ? `${SKY_LABEL[sky]}. The ${body} is ${Math.round(t * 100)} percent of the way across the sky.` : "Sky"}>
            <defs>
              <radialGradient id="orbglow">
                <stop offset="0" stopColor="var(--orb-glow)" />
                <stop offset="1" stopColor="var(--orb-glow)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path d={`M${P0[0]} ${P0[1]} Q${C[0]} ${C[1]} ${P2[0]} ${P2[1]}`} fill="none" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
            <line x1="8" y1="142" x2="392" y2="142" stroke="var(--line)" strokeWidth="1" />
            {now && (
              <g style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 1.2s cubic-bezier(0.16,1,0.3,1)" }}>
                <circle r={body === "sun" ? 56 : 44} fill="url(#orbglow)" />
                <circle r={body === "sun" ? 17 : 14} fill="var(--orb)" />
              </g>
            )}
          </svg>
          <p className="mt-1 flex items-baseline gap-3 text-small text-ink-soft tabular">
            <span>{now ? SKY_LABEL[sky] : " "}</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--line)]" />
            <span>{now ? now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : " "}</span>
          </p>
        </div>

        <div className="pb-1">
          <h1 id="hero-line" className="display text-[clamp(2.1rem,7vw,3.6rem)] leading-[1.06] short:text-[1.9rem]">{now ? LINE[sky] : LINE.day}</h1>
          <Link
            href={`/recitations?set=${set}`}
            className="cta cta-solid group mt-7"
          >
            {setDone ? (
              <span className="grid size-[60px] shrink-0 place-items-center rounded-full bg-accent-ink text-accent" aria-hidden><Check size={30} /></span>
            ) : (
            <Ring count={count} total={total} />
            )}
            <span className="grid flex-1">
              <span className="text-lead font-semibold leading-snug">{!ready ? "Today\u2019s adhkar" : setDone ? `${SETS[set]} complete` : SETS[set]}</span>
              <span className="text-meta opacity-90 tabular">{!ready ? "\u00a0" : setDone ? `All ${total} recited today` : `${count} of ${total} adhkar today`}</span>
            </span>
            <Chevron className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          {friday && (
            <Link
              href={readHref(18, kahfDone ? 1 : kahfAt)}
              className={`cta group mt-3 ${kahfDone ? "cta-solid" : "cta-outline"}`}
            >
              {kahfDone && <span className="grid size-[44px] shrink-0 place-items-center rounded-full bg-accent-ink text-accent" aria-hidden><Check size={24} /></span>}
              <span className="grid flex-1">
                <span className="text-lead font-semibold leading-snug">{kahfDone ? "Friday recitation complete" : "Friday recitation"}</span>
                <span className={`text-meta ${kahfDone ? "opacity-90" : "text-ink-soft"}`}>
                  {kahfDone ? (
                    <>Surah {kahf.name} read today</>
                  ) : (
                    <>Surah {kahf.name} · <span className="tabular">{kahfSeen > 0 ? `${kahfSeen} of ${kahf.verses} read today` : `${kahf.verses} verses`}</span>{kahfAt > 1 && kahfSeen === 0 ? ` · resume at ${kahfAt}` : ""}</>
                  )}
                </span>
              </span>
              <Chevron className={`transition-transform duration-300 group-hover:translate-x-1 ${kahfDone ? "" : "text-accent"}`} />
            </Link>
          )}
          {afterMaghrib && (
            <Link href={readHref(56, waqiahDone ? 1 : waqiahAt)} className="cta cta-solid group mt-3">
              {waqiahDone ? (
                <span className="grid size-[60px] shrink-0 place-items-center rounded-full bg-accent-ink text-accent" aria-hidden><Check size={30} /></span>
              ) : (
                <Ring count={waqiahSeen} total={waqiah.verses} />
              )}
              <span className="grid flex-1">
                <span className="text-lead font-semibold leading-snug">{waqiahDone ? "Waqi\u2019ah reminder complete" : "Waqi\u2019ah reminder"}</span>
                <span className="text-meta opacity-90 tabular">
                  {waqiahDone ? `Surah ${waqiah.name} read today` : waqiahSeen > 0 ? `${waqiahSeen} of ${waqiah.verses} verses read` : `Surah ${waqiah.name} \u00b7 ${waqiah.verses} verses${waqiahAt > 1 ? ` \u00b7 resume at ${waqiahAt}` : ""}`}
                </span>
              </span>
              <Chevron className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          )}
          {quran.last && (
            <Link href={readHref(quran.last.surah, quran.last.verse)} className="mt-3 flex min-h-14 items-center justify-between rounded-full border border-line px-5 no-underline">
              <span>Continue reading <span className="font-semibold">{chapter(quran.last.surah).name}</span></span>
              <span className="text-ink-soft tabular">{quran.last.surah}:{quran.last.verse}</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/** The progress ring on the routine tiles: how many of the total are done. */
function Ring({ count, total }: { count: number; total: number }) {
  const R = 26, CIRC = 2 * Math.PI * R;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden className="shrink-0">
      <circle cx="30" cy="30" r={R} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="4" />
      <circle
        cx="30" cy="30" r={R} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - (total ? Math.min(1, count / total) : 0))}
        transform="rotate(-90 30 30)"
        style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)" }}
      />
      <text x="30" y="35" textAnchor="middle" fontSize={total > 20 ? 13 : 15} fontWeight="600" fill="currentColor" className="tabular">{count}/{total}</text>
    </svg>
  );
}
