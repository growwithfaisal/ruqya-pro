"use client";
import { useState, type ReactNode } from "react";
import { dismissInstall, installNow, useInstall } from "@/lib/install";
import { stepsFor, type Platform, type Step } from "@/lib/install-platform";
import { AddSquare, ArrowDown, ArrowUp, Check, Dots, OpenOut, ShareMark, Wordmark } from "./Glyphs";
import { Sheet } from "./Sheet";

const ICON: Record<Step["icon"], ReactNode> = {
  share: <ShareMark size={28} />,
  add: <AddSquare size={28} />,
  more: <Dots size={28} />,
  menu: <Dots size={28} />,
  dock: <AddSquare size={28} />,
  open: <OpenOut size={28} />,
  check: <Check size={28} />,
};

/** What the offer says, for each place the app can be added. */
function words(platform: Platform) {
  if (platform === "desktop-chromium") return { title: "Install RuqyaPro on this computer", body: "It opens in its own window, like an app, and works without internet.", action: "Install" };
  if (platform === "mac-safari") return { title: "Keep RuqyaPro in your Dock", body: "It opens in its own window, like an app, and works without internet.", action: "Show me how" };
  if (platform === "inapp") return { title: "Open RuqyaPro in your browser", body: "You are inside another app. Open this page in Safari or Chrome, then add RuqyaPro to your Home Screen.", action: "Show me how" };
  return { title: "Keep RuqyaPro on your Home Screen", body: "It opens in one tap, like any other app, and works without internet.", action: "Add to Home Screen" };
}

/** The steps, one per line, big enough to read at a glance, with an arrow toward where the reader has to tap. */
function Guide({ platform, open, onOpenChange }: { platform: Platform; open: boolean; onOpenChange: (o: boolean) => void }) {
  const guide = stepsFor(platform);
  if (!guide) return null;
  const Arrow = guide.where === "bottom" ? ArrowDown : ArrowUp;
  const pointer = (
    <p className={`flex items-center justify-center gap-3 rounded-full border border-line px-4 py-3 text-small ${guide.where === "bottom" ? "mt-4" : "mb-4"}`}>
      <Arrow size={22} className={guide.where === "bottom" ? "nudge-down" : "nudge-up"} />
      <span>{guide.where === "bottom" ? "Look at the bar at the bottom of your screen" : "Look at the top of your screen"}</span>
    </p>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={guide.title} description={guide.blurb}>
      {guide.where === "top" && pointer}
      <ol className="grid gap-5">
        {guide.steps.map((s, i) => (
          <li key={i} className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink tabular text-lead font-semibold" aria-hidden>{i + 1}</span>
            <span className="grid min-w-0 flex-1 gap-1">
              <span className="flex items-center gap-3 text-lead font-semibold leading-snug">
                <span className="shrink-0 text-accent" aria-hidden>{ICON[s.icon]}</span>
                <span>{s.text}</span>
              </span>
              {s.hint && <span className="text-small text-card-soft">{s.hint}</span>}
            </span>
          </li>
        ))}
      </ol>
      {guide.where === "bottom" && pointer}
      <button onClick={() => onOpenChange(false)} className="btn btn-primary mt-6 w-full">Got it</button>
    </Sheet>
  );
}

/** One button for both kinds of device: the browser's own dialog where it exists, the steps where it does not. */
function useAdd(phase: string, platform: Platform) {
  const [guide, setGuide] = useState(false);
  const [added, setAdded] = useState(false);
  const act = async () => {
    if (phase === "native") {
      if ((await installNow()) === "accepted") setAdded(true);
    } else setGuide(true);
  };
  return { act, added, guideSheet: <Guide platform={platform} open={guide} onOpenChange={setGuide} /> };
}

/** On Home, for anyone who has not added the app yet. */
export function InstallPrompt() {
  const { phase, platform } = useInstall();
  const { act, added, guideSheet } = useAdd(phase, platform);
  if (added) {
    return (
      <section aria-label="Added" className="mx-auto max-w-5xl px-4 pt-6 md:px-8">
        <p role="status" className="glass flex items-center gap-3 rounded-[28px] border border-line px-5 py-4 text-card-ink">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-ink" aria-hidden><Check size={22} /></span>
          <span><strong className="font-semibold">Added.</strong> From now on, open RuqyaPro from your {platform === "desktop-chromium" ? "apps" : "Home Screen"}.</span>
        </p>
      </section>
    );
  }
  if (phase === "checking" || phase === "hidden") return null;
  const w = words(platform);
  return (
    <section aria-labelledby="install-title" className="mx-auto max-w-5xl px-4 pt-6 md:px-8">
      <div className="glass rounded-[28px] border border-line p-5 text-card-ink">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full border border-line text-accent" aria-hidden><Wordmark size={28} /></span>
          <div className="min-w-0">
            <h2 id="install-title" className="display text-title leading-tight">{w.title}</h2>
            <p className="mt-1 text-small text-card-soft">{w.body}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-1">
          <button onClick={act} className="btn btn-primary w-full">{w.action}</button>
          <button onClick={dismissInstall} className="min-h-11 rounded-full text-small text-card-soft underline">Not now</button>
        </div>
      </div>
      {guideSheet}
    </section>
  );
}

/** In Settings, for anyone who said "Not now" earlier, or wants to do it later. */
export function InstallRow() {
  const { phase, platform } = useInstall(false);
  const { act, added, guideSheet } = useAdd(phase, platform);
  if (added) return <p role="status" className="border-b border-line py-4 text-small">Added. Open RuqyaPro from your Home Screen from now on.</p>;
  if (phase === "checking" || phase === "hidden") return null;
  const w = words(platform);
  return (
    <div className="grid gap-3 border-b border-line py-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
      <span className="grid min-w-0 flex-1">
        <span>{w.title}</span>
        <span className="text-meta text-ink-soft">{w.body}</span>
      </span>
      <button onClick={act} className="btn btn-sm btn-primary w-full sm:w-auto">{w.action}</button>
      {guideSheet}
    </div>
  );
}
