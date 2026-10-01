/**
 * Transliteration with marks. Underlined: a letter that can be said more than one way (heavy letters) and long vowels.
 * Bold and faded: a letter that is not said. The letters themselves are never changed.
 */
export function Translit({
  text, marks, silent,
}: { text: string; marks?: [number, number][] | null; silent?: [number, number][] | null }) {
  if (!marks?.length && !silent?.length) return <>{text}</>;
  const kind = new Array<number>(text.length).fill(0); // bit 1 = underline, bit 2 = silent
  marks?.forEach(([a, b]) => { for (let i = a; i < Math.min(b, text.length); i++) kind[i] |= 1; });
  silent?.forEach(([a, b]) => { for (let i = a; i < Math.min(b, text.length); i++) kind[i] |= 2; });
  const out: React.ReactNode[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || kind[i] !== kind[start]) {
      const piece = text.slice(start, i);
      const k = kind[start];
      out.push(
        k === 0 ? piece : (
          <span key={start} className={`${k & 1 ? "underline decoration-[1.5px] underline-offset-[0.22em] " : ""}${k & 2 ? "font-bold opacity-50" : ""}`}>{piece}</span>
        ),
      );
      start = i;
    }
  }
  return <>{out}</>;
}
