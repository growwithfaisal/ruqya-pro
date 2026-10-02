"use client";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";

/**
 * A press held for `ms` without moving more than `slop` px. Spread `bind` on the element; `pressing` is true while the
 * finger is down and the hold is still counting, so the element can lean in as feedback.
 * A right-click or the long-press menu event (Android) opens it too, once. A lifted finger or a scroll cancels it.
 */
export function useLongPress(onLongPress: () => void, { ms = 450, slop = 10 } = {}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const callback = useRef(onLongPress);
  const [pressing, setPressing] = useState(false);

  useEffect(() => { callback.current = onLongPress; });

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
    setPressing(false);
  }, []);
  useEffect(() => cancel, [cancel]);

  const open = useCallback(() => {
    fired.current = true;
    try { navigator.vibrate?.(12); } catch {}
    callback.current();
  }, []);

  const bind = {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancel();
      from.current = { x: e.clientX, y: e.clientY };
      setPressing(true);
      timer.current = setTimeout(() => { cancel(); open(); }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      if (from.current && Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) > slop) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      if (!fired.current) open();
    },
    // The click that follows a held press must not do a second thing. A keyboard click (detail 0) is never that.
    onClickCapture: (e: MouseEvent) => {
      const held = fired.current && e.detail > 0;
      fired.current = false;
      if (held) { e.stopPropagation(); e.preventDefault(); }
    },
  };

  return { pressing, bind };
}
