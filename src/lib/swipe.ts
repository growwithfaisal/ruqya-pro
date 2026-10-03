"use client";
import { useMemo, useRef, type PointerEvent } from "react";
import { haptic } from "./haptics";
import { DragControls, type Transition, type Variants } from "framer-motion";

/** Where a press never starts a swipe: anything the reader taps or types into. */
const CONTROLS = "button, a, input, textarea, select, label, summary, [role=slider], [role=switch], [data-noswipe]";

/**
 * Lets a swipe that starts anywhere on the reading screen move the card, not only one that starts on the card. The card
 * keeps its own drag, so it still follows the finger and the same distance or speed turns the page; this only starts that
 * drag from the rest of the screen. A fresh set of controls per card, so a card still sliding out is never moved again.
 *
 * Put `onPointerDown` and `touch-pan-y` on the reading screen, and `dragControls={controls}`, `dragListener={false}` and
 * `data-swipe-card` on the card. The card tracks the finger 1:1 (dragElastic 1) and only resists, rubber-band style,
 * where there is no page to turn to.
 */
export function useSwipeAnywhere(
  cardKey: string,
  blocked: boolean,
  { width, canTurn }: { width: () => number; canTurn: (dir: 1 | -1) => boolean },
) {
  // cardKey is the dependency on purpose: each card gets its own controls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const controls = useMemo(() => new DragControls(), [cardKey]);
  // The page-turn decision, made inside the pointerup (where iPhone allows the haptic) and used by the card's drag end.
  const decided = useRef<{ dir: 1 | -1; v: number } | null | undefined>(undefined);
  const onPointerDown = (ev: PointerEvent<HTMLElement>) => {
    if (blocked || !ev.isPrimary || (ev.pointerType === "mouse" && ev.button !== 0)) return;
    const t = ev.target;
    // Sheets are portals: their presses bubble through React but are not inside this screen.
    if (!(t instanceof Element) || !ev.currentTarget.contains(t) || t.closest(CONTROLS)) return;
    // With a mouse, a drag outside the card selects text (the arrow keys turn the page); a finger or pen swipes anywhere.
    if (ev.pointerType === "mouse" && !t.closest("[data-swipe-card]")) return;
    controls.start(ev);
    decided.current = undefined;
    trackRelease(ev.nativeEvent, ({ dx, vx }) => {
      const dir = turnFrom(dx, vx, width());
      decided.current = dir && canTurn(dir) ? { dir, v: vx } : null;
      if (decided.current) haptic();
    });
  };
  /** For the card's onDragEnd: the decision taken at release (null: spring back), or undefined if none was tracked. */
  const release = () => {
    const d = decided.current;
    decided.current = undefined;
    return d;
  };
  return { controls, onPointerDown, release };
}

export interface Release { dx: number; dy: number; vx: number; vy: number }

/**
 * Follows one press until the finger lifts and reports how far it went and how fast it was moving (px/s, over the last
 * 100ms, as framer measures it) from inside the pointerup itself. framer tells the drag's end a frame later, which is
 * too late for iPhone's haptic. A cancelled press (the page scrolled instead) reports nothing.
 */
export function trackRelease(start: globalThis.PointerEvent, onRelease: (r: Release) => void) {
  const id = start.pointerId;
  const hist = [{ x: start.clientX, y: start.clientY, t: performance.now() }];
  const move = (e: globalThis.PointerEvent) => { if (e.pointerId === id) hist.push({ x: e.clientX, y: e.clientY, t: performance.now() }); };
  const stop = () => {
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", end, true);
    window.removeEventListener("pointercancel", end, true);
  };
  function end(e: globalThis.PointerEvent) {
    if (e.pointerId !== id) return;
    stop();
    if (e.type === "pointercancel") return;
    hist.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    const last = hist[hist.length - 1];
    let from = hist[0];
    for (let i = hist.length - 1; i >= 0; i--) { from = hist[i]; if (last.t - hist[i].t > 100) break; }
    const dt = (last.t - from.t) / 1000;
    onRelease({
      dx: last.x - hist[0].x,
      dy: last.y - hist[0].y,
      vx: dt > 0 ? (last.x - from.x) / dt : 0,
      vy: dt > 0 ? (last.y - from.y) / dt : 0,
    });
  }
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", end, true);
  window.addEventListener("pointercancel", end, true);
}

/**
 * Where a flick would come to rest, as scrolling would carry it (Apple's projection, deceleration 0.998 per ms).
 * A 500 px/s flick travels about 250px more.
 */
export const project = (velocity: number, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);

/**
 * Snap to whichever page is nearer to where the card would come to rest, carried on by its momentum: past half its width
 * the page turns. A short quick flick carries far enough; a slow drag that stops short springs back.
 */
export function turnFrom(offset: number, velocity: number, width: number): 1 | -1 | 0 {
  const rest = offset + project(velocity);
  if (Math.abs(rest) < width * 0.5) return 0;
  return rest < 0 ? 1 : -1;
}

/** How the page turned: which way, how fast the finger let go (px/s, 0 for a button), and the card's width. */
export interface Turn { dir: number; v: number; w: number }
export const NO_TURN: Turn = { dir: 1, v: 0, w: 360 };

/**
 * The card's motion. The card that leaves keeps going the way the finger threw it, from where it was let go and at the
 * finger's speed, until it is off the card's width; the next one comes in from the other side. Both settle on a
 * critically damped spring (no overshoot). With reduced motion, a short cross-fade instead.
 */
export function turnVariants(reduce: boolean): Variants {
  if (reduce) {
    return {
      enter: { opacity: 0 },
      center: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.15 } },
    };
  }
  return {
    enter: ({ dir, w }: Turn) => ({ x: dir * w * 0.35, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: ({ dir, v, w }: Turn) => ({
      x: -dir * (w + 24),
      opacity: 0,
      transition: { x: { type: "spring", bounce: 0, visualDuration: 0.3, velocity: v }, opacity: { duration: 0.24, ease: "easeOut" } },
    }),
  };
}

export const turnTransition = (reduce: boolean): Transition =>
  reduce ? { duration: 0.15 } : { x: { type: "spring", bounce: 0, visualDuration: 0.32 }, opacity: { duration: 0.2, ease: "easeOut" } };
