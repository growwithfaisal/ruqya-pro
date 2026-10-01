"use client";
import { PrayerPrefs, Place, SkyTimeline, arcFromTimeline, readInputs, skyFromTimeline, skyTimeline, writeSkyCache } from "./prayer";
import { arcProgress, decimalHour, skyForHour, type Sky } from "./sky";

export interface LiveSky { sky: Sky; body: "sun" | "moon"; t: number; real: boolean; timeline: SkyTimeline | null }

/** The sky for this moment: from the real sunrise and sunset at the reader's saved place, else from fixed clock hours. */
export function liveSky(now = new Date(), inputs: { place: Place | null; prefs: PrayerPrefs } = readInputs()): LiveSky {
  if (inputs.place) {
    const tl = skyTimeline(inputs.place, inputs.prefs, now);
    const sky = tl && skyFromTimeline(tl, now);
    const arc = tl && arcFromTimeline(tl, now);
    if (tl && sky && arc) return { sky, ...arc, real: true, timeline: tl };
  }
  const h = decimalHour(now);
  return { sky: skyForHour(h), ...arcProgress(h), real: false, timeline: null };
}

export { writeSkyCache };
