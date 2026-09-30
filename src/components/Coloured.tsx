import { TAJWEED } from "@/lib/quran";

/** The exact Arabic, cut into runs; runs inside a range get a colour class. No letter is added, removed or changed. */
export function Coloured({ ar, ranges, lead }: { ar: string; ranges: [number, number, number][]; lead: number }) {
  const out: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([from, to, cls], i) => {
    const a = Math.max(0, from - lead);
    const b = Math.max(0, to - lead);
    if (b <= at) return;
    if (a > at) out.push(ar.slice(at, a));
    out.push(<span key={i} className={`tj-${TAJWEED[cls][0]}`}>{ar.slice(Math.max(a, at), b)}</span>);
    at = b;
  });
  if (at < ar.length) out.push(ar.slice(at));
  return <>{out}</>;
}
