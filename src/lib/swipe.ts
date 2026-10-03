"use client";
import { useMemo, type PointerEvent } from "react";
import { DragControls } from "framer-motion";

/** Where a press never starts a swipe: anything the reader taps or types into. */
const CONTROLS = "button, a, input, textarea, select, label, summary, [role=slider], [role=switch], [data-noswipe]";

/**
 * Lets a swipe that starts anywhere on the reading screen move the card, not only one that starts on the card. The card
 * keeps its own drag, so it still follows the finger and the same distance or speed turns the page; this only starts that
 * drag from the rest of the screen. A fresh set of controls per card, so a card still sliding out is never moved again.
 *
 * Put `onPointerDown` and `touch-pan-y` on the reading screen, and `dragControls={controls}`, `dragListener={false}` and
 * `data-swipe-card` on the card.
 */
export function useSwipeAnywhere(cardKey: string, blocked: boolean) {
  // cardKey is the dependency on purpose: each card gets its own controls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const controls = useMemo(() => new DragControls(), [cardKey]);
  const onPointerDown = (ev: PointerEvent<HTMLElement>) => {
    if (blocked || !ev.isPrimary || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    const t = ev.target;
    // Sheets are portals: their presses bubble through React but are not inside this screen.
    if (!(t instanceof Element) || !ev.currentTarget.contains(t) || t.closest(CONTROLS)) return;
    // With a mouse, a drag outside the card selects text (the arrow keys turn the page); a finger or pen swipes anywhere.
    if (ev.pointerType === "mouse" && !t.closest("[data-swipe-card]")) return;
    controls.start(ev);
  };
  return { controls, onPointerDown };
}
