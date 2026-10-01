"use client";
import { useEffect, useState } from "react";

/** A- / A+ for Arabic text. Same key and CSS variable the boot script in layout.tsx restores before paint. */
export function ArabicSizeControl() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    try { setScale(parseFloat(localStorage.getItem("rp:arabic") || "1") || 1); } catch {}
  }, []);

  const size = (delta: number) => {
    const n = Math.max(0.8, Math.min(1.8, +(scale + delta).toFixed(2)));
    setScale(n);
    document.documentElement.style.setProperty("--arabic-scale", String(n));
    try { localStorage.setItem("rp:arabic", String(n)); } catch {}
  };

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Arabic size">
      <button className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line text-meta" onClick={() => size(-0.1)} aria-label="Smaller Arabic">A−</button>
      <button className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line text-lead" onClick={() => size(0.1)} aria-label="Larger Arabic">A+</button>
    </div>
  );
}
