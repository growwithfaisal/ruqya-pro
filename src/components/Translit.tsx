/** Transliteration with the letters that can be said more than one way underlined. The letters themselves are never changed. */
export function Translit({ text, marks }: { text: string; marks?: [number, number][] | null }) {
  if (!marks?.length) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let at = 0;
  marks.forEach(([a, b], i) => {
    if (a < at || b > text.length) return;
    if (a > at) out.push(text.slice(at, a));
    out.push(<span key={i} className="underline decoration-[1.5px] underline-offset-[0.22em]">{text.slice(a, b)}</span>);
    at = b;
  });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}
