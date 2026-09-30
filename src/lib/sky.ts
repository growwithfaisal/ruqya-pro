import type { TimeTag } from "./types";

export type Sky = "dawn" | "day" | "dusk" | "night";

export const SKY_LABEL: Record<Sky, string> = { dawn: "Dawn", day: "Daytime", dusk: "Dusk", night: "Night" };

/** Device local time only. No location, no prayer-time API. */
export function skyForHour(h: number): Sky {
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 16.5) return "day";
  if (h >= 16.5 && h < 19.5) return "dusk";
  return "night";
}

export function setForHour(h: number): TimeTag {
  if (h >= 4 && h < 15) return "morning";
  if (h >= 15 && h < 20) return "evening";
  return "bedtime";
}

export function decimalHour(d = new Date()) {
  return d.getHours() + d.getMinutes() / 60;
}

/** Position of the sun (5:00 to 19:00) or moon (19:00 to 5:00) along the arc, 0..1. */
export function arcProgress(h: number) {
  if (h >= 5 && h < 19) return { body: "sun" as const, t: (h - 5) / 14 };
  const n = h >= 19 ? h - 19 : h + 5;
  return { body: "moon" as const, t: n / 10 };
}
