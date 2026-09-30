"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { arcProgress, decimalHour, setForHour, skyForHour, SKY_LABEL, type Sky } from "@/lib/sky";
import { useDone } from "@/lib/progress";
import { chapter, readHref } from "@/lib/quran";
import { useQuran } from "@/lib/quran-store";
import { SETS } from "@/lib/entries";
import type { TimeTag } from "@/lib/types";
import { Chevron } from "./Glyphs";

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
  const { done } = useDone();
  const quran = useQuran();

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const h = now ? decimalHour(now) : 9;
  const override = typeof document !== "undefined" ? (document.documentElement.dataset.sky as Sky) : undefined;
  const sky = now ? (override ?? skyForHour(h)) : "day";
  // When previewing with ?sky=, place the body at a representative hour for that sky.
  const preview = { dawn: 6.5, day: 12, dusk: 18, night: 22 }[sky];
  const shown = now && override && override !== skyForHour(h) ? preview : h;
  const { body, t } = arcProgress(shown);
  const [x, y] = at(t);
  const set: TimeTag = setForHour(shown);
  const ids = setIds[set];
  const count = ids.filter((i) => done.has(i)).length;
  const total = ids.length;
  const R = 26, CIRC = 2 * Math.PI * R;

  return (
    <section aria-labelledby="hero-line" className="mx-auto max-w-5xl px-4 pt-8 md:px-8 md:pt-14">
      <div className="grid items-end gap-6 md:grid-cols-[1.15fr_1fr] md:gap-12">
        <div className="relative">
          <svg viewBox="0 0 400 150" className="w-full overflow-visible" role="img" aria-label={now ? `${SKY_LABEL[sky]}. The ${body} is ${Math.round(t * 100)} percent of the way across the sky.` : "Sky"}>
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
          <p className="mt-1 flex items-baseline gap-3 text-[0.95rem] text-ink-soft tabular">
            <span>{now ? SKY_LABEL[sky] : " "}</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--line)]" />
            <span>{now ? now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : " "}</span>
          </p>
        </div>

        <div className="pb-1">
          <h1 id="hero-line" className="display text-[clamp(2.1rem,7vw,3.6rem)] leading-[1.06]">{now ? LINE[sky] : LINE.day}</h1>
          <Link
            href={`/recitations?set=${set}`}
            className="group mt-7 flex min-h-[4.5rem] items-center gap-4 rounded-[28px] bg-accent px-5 py-3 text-accent-ink no-underline transition-transform duration-200 active:scale-[0.98]"
          >
            <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden className="shrink-0">
              <circle cx="30" cy="30" r={R} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="4" />
              <circle
                cx="30" cy="30" r={R} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - (total ? count / total : 0))}
                transform="rotate(-90 30 30)"
                style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)" }}
              />
              <text x="30" y="35" textAnchor="middle" fontSize="15" fontWeight="600" fill="currentColor" className="tabular">{count}/{total}</text>
            </svg>
            <span className="grid flex-1">
              <span className="text-[1.1rem] font-semibold">{SETS[set]}</span>
              <span className="text-[0.92rem] opacity-90 tabular">{count} of {total} adhkar today</span>
            </span>
            <Chevron className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
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
