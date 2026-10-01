"use client";
import { useEffect, useState } from "react";

const KEY = "rp:v1:hint:install";

/** On an iPhone or iPad, in Safari and not yet on the Home Screen: one quiet line on how to add the app. Dismissed for good with one tap. */
export function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const nav = navigator as Navigator & { standalone?: boolean; maxTouchPoints: number };
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && nav.maxTouchPoints > 1);
      const installed = nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
      if (ios && !installed && !localStorage.getItem(KEY)) setShow(true);
    } catch {}
  }, []);

  if (!show) return null;
  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setShow(false);
  };

  return (
    <section aria-label="Add to Home Screen" className="mx-auto max-w-5xl px-4 pt-6 md:px-8">
      <div className="glass flex items-center gap-4 rounded-[28px] border border-line px-5 py-4 text-card-ink">
        <p className="flex-1 text-small">
          <strong className="font-semibold">Keep RuqyaPro on your Home Screen.</strong>{" "}
          Tap <span className="whitespace-nowrap">Share</span>, then <span className="whitespace-nowrap">Add to Home Screen</span>. It opens like an app, works without internet and keeps your progress on this phone.
        </p>
        <button onClick={dismiss} className="btn btn-sm btn-secondary shrink-0">Got it</button>
      </div>
    </section>
  );
}
