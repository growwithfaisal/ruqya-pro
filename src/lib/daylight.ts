/**
 * The prayer card's own sky. Each prayer has a pair of colours (top, bottom) for the moment it begins; the card blends
 * smoothly from one pair to the next as the minutes pass, so the gradient is always the colour of the sun's place in the day.
 * Blending happens in OKLab, so mid-points stay clean instead of going muddy. Text colour is chosen from the result.
 */
type RGB = [number, number, number];
export type SkyName = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;

// Every pair stays dark enough for the light ink to keep at least 4.5:1 against both colours all the way through each blend (see scripts/check-daylight.mts).
const PALETTE: Record<SkyName, [RGB, RGB]> = {
  Fajr: [hex("#161c4d"), hex("#5a3d86")], // before dawn: indigo into amethyst
  Sunrise: [hex("#3a62ae"), hex("#b0502d")], // first light: morning blue over burnt apricot
  Dhuhr: [hex("#1f68b4"), hex("#2570b6")], // high sun: clear, saturated blue
  Asr: [hex("#2b6caa"), hex("#9a5f14")], // afternoon: blue easing into amber
  Maghrib: [hex("#2f2468"), hex("#a8402f")], // sunset: plum over ember
  Isha: [hex("#0c1235"), hex("#2c2f78")], // night: deep indigo
};
const ORDER: SkyName[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
const DARK_INK = hex("#0e1630");
const LIGHT_INK = hex("#fdf8ee");

const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const unlin = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toLab([r, g, b]: RGB): RGB {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromLab([L, a, b]: RGB): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const out = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return out.map((c) => Math.min(255, Math.max(0, unlin(Math.min(1, Math.max(0, c)))))) as RGB;
}
export function mix(a: RGB, b: RGB, t: number): RGB {
  const A = toLab(a), B = toLab(b);
  return fromLab([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
const luminance = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a: RGB, b: RGB) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const css = (c: RGB) => `rgb(${c.map(Math.round).join(" ")})`;

export interface Daylight { top: RGB; bottom: RGB; ink: RGB; dark: boolean; background: string; color: string }

/** `from` is the period now running, `to` the one that follows, `progress` 0..1 through it. */
export function daylight(from: SkyName, to: SkyName, progress: number): Daylight {
  const t = Math.min(1, Math.max(0, progress));
  const top = mix(PALETTE[from][0], PALETTE[to][0], t);
  const bottom = mix(PALETTE[from][1], PALETTE[to][1], t);
  const worst = (ink: RGB) => Math.min(contrast(ink, top), contrast(ink, bottom));
  const dark = worst(DARK_INK) >= worst(LIGHT_INK);
  const ink = dark ? DARK_INK : LIGHT_INK;
  return {
    top, bottom, ink, dark,
    color: css(ink),
    background: `radial-gradient(120% 90% at 12% 0%, rgb(255 255 255 / ${dark ? 0.3 : 0.08}), transparent 60%), linear-gradient(165deg, ${css(top)}, ${css(bottom)})`,
  };
}

/** When the reader has not shared a place yet the card still moves with the clock, on typical hours. */
const NOMINAL: [SkyName, number][] = [["Fajr", 5], ["Sunrise", 6.5], ["Dhuhr", 12.5], ["Asr", 15.5], ["Maghrib", 18.5], ["Isha", 20]];
export function nominalDaylight(now: Date): Daylight {
  const h = now.getHours() + now.getMinutes() / 60;
  let i = NOMINAL.findLastIndex(([, at]) => h >= at);
  if (i < 0) i = NOMINAL.length - 1; // before Fajr: still Isha's night
  const start = NOMINAL[i][1], next = NOMINAL[(i + 1) % NOMINAL.length][1];
  const span = (next - start + 24) % 24 || 24;
  return daylight(NOMINAL[i][0], NOMINAL[(i + 1) % NOMINAL.length][0], ((h - start + 24) % 24) / span);
}

export const nextSky = (n: SkyName): SkyName => ORDER[(ORDER.indexOf(n) + 1) % ORDER.length];
export const PALETTE_FOR_CHECK = PALETTE;
