"use client";
import { useEffect, useState } from "react";

/** A- / A+ for transliteration. Same pattern as the Arabic size; the boot script in layout.tsx restores it before paint. */
export function TranslitSizeControl() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    try { setScale(parseFloat(localStorage.getItem("rp:translit") || "1") || 1); } catch {}
  }, []);

  const size = (delta: number) => {
    const n = Math.max(0.8, Math.min(1.8, +(scale + delta).toFixed(2)));
    setScale(n);
    document.documentElement.style.setProperty("--translit-scale", String(n));
    try { localStorage.setItem("rp:translit", String(n)); } catch {}
  };

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Transliteration size">
      <button className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line text-meta" onClick={() => size(-0.1)} aria-label="Smaller transliteration">A−</button>
      <button className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line text-lead" onClick={() => size(0.1)} aria-label="Larger transliteration">A+</button>
    </div>
  );
}
