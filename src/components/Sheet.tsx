"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, DragControls, animate, motion, useMotionValue, useReducedMotion, type PanInfo, type Variants } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { project, trackRelease } from "@/lib/swipe";
import { haptic } from "@/lib/haptics";

/** Opening and closing: a spring with a touch of give (damping about 0.85), quick to settle. */
const SPRING = { type: "spring", bounce: 0.15, visualDuration: 0.32 } as const;
/** A sheet snaps to whichever is nearer to where the flick would carry it, open or closed: past half its size it closes. */
const CLOSE_AT = 0.5;

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const set = () => setWide(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);
  return wide;
}

interface Exit { v: number }

/**
 * The app's slide-over: a bottom sheet on phones, a right panel from 768px. It is a real object: pull it down (or to the
 * right) by its top strip and it follows the finger, a pull the other way meets soft resistance, and letting go decides by
 * where the flick would carry it: past half the way it closes at the finger's speed, short of that it springs
 * back. It can be caught while it is still opening. Close, Escape and a tap on the dimmed page still work, and Radix keeps
 * focus inside while it is open. With reduced motion it simply fades.
 */
export function Sheet({
  open, onOpenChange, title, description, children,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) {
  const reduce = !!useReducedMotion();
  const wide = useWide();
  const controls = useMemo(() => new DragControls(), []);
  const panel = useRef<HTMLDivElement>(null);
  const dim = useMotionValue(1); // the scrim lightens as the sheet is pulled away
  const [exit, setExit] = useState<Exit>({ v: 0 });

  // Each opening starts from a full scrim.
  useEffect(() => {
    if (open) dim.set(1);
  }, [open, dim]);
  // Closed by Close, Escape or the scrim: no throw to carry on. A drag sets its own speed first (onDragEnd).
  const change = (o: boolean) => {
    if (!o) setExit({ v: 0 });
    onOpenChange(o);
  };

  const size = () => (wide ? panel.current?.offsetWidth : panel.current?.offsetHeight) || 600;
  const travelOf = (info: PanInfo) => (wide ? info.offset.x : info.offset.y);
  const speedOf = (info: PanInfo) => (wide ? info.velocity.x : info.velocity.y);

  // Close or spring back is decided inside the finger's release, where iPhone allows the haptic (framer reports the
  // drag's end a frame later); onDragEnd then acts on it.
  const decided = useRef<{ close: boolean; v: number } | null>(null);
  const grab = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || (e.target instanceof Element && e.target.closest("button, a, input, select, textarea"))) return;
    controls.start(e);
    decided.current = null;
    trackRelease(e.nativeEvent, ({ dx, dy, vx, vy }) => {
      const travel = wide ? dx : dy;
      const v = wide ? vx : vy;
      decided.current = { close: travel + project(v) > size() * CLOSE_AT, v };
      if (decided.current.close) haptic();
    });
  };
  const onDrag = (_: unknown, info: PanInfo) => dim.set(1 - Math.min(1, Math.max(0, travelOf(info)) / size()));
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const d = decided.current ?? { close: travelOf(info) + project(speedOf(info)) > size() * CLOSE_AT, v: speedOf(info) };
    decided.current = null;
    if (d.close) {
      setExit({ v: d.v });
      onOpenChange(false);
    } else {
      animate(dim, 1, { duration: 0.25 });
    }
  };

  const variants: Variants = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.2 } }, gone: { opacity: 0, transition: { duration: 0.15 } } }
    : {
        hidden: wide ? { x: "100%" } : { y: "100%" },
        shown: { x: 0, y: 0, transition: SPRING },
        gone: ({ v }: Exit) => (wide ? { x: "100%", transition: { ...SPRING, bounce: 0, velocity: v } } : { y: "100%", transition: { ...SPRING, bounce: 0, velocity: v } }),
      };

  return (
    <Dialog.Root open={open} onOpenChange={change}>
      <AnimatePresence custom={exit}>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0.15 : 0.3, ease: "easeOut" }}>
                <motion.div className="absolute inset-0 bg-black/45" style={{ opacity: dim }} />
              </motion.div>
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                ref={panel}
                custom={exit}
                variants={variants}
                initial="hidden"
                animate="shown"
                exit="gone"
                drag={reduce ? false : wide ? "x" : "y"}
                dragControls={controls}
                dragListener={false}
                dragConstraints={wide ? { left: 0, right: 0 } : { top: 0, bottom: 0 }}
                dragElastic={wide ? { left: 0.06, right: 1 } : { top: 0.06, bottom: 1 }}
                dragTransition={{ bounceStiffness: 420, bounceDamping: 36 }}
                onDrag={onDrag}
                onDragEnd={onDragEnd}
                className="drawer-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col glass-strong rounded-t-[28px] border border-line text-card-ink shadow-[0_-16px_48px_-16px_rgb(0_0_0/0.4)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[28rem] md:rounded-l-[28px] md:rounded-tr-none"
              >
                {/* The handle: the grabber and the title strip pick the sheet up; the list below keeps its own scrolling. */}
                <div onPointerDown={grab} className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing">
                  <div aria-hidden className="mx-auto mt-2.5 h-[5px] w-9 rounded-full bg-[color-mix(in_oklch,var(--card-ink)_26%,transparent)] md:hidden" />
                  <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-3.5 md:pt-6">
                    <div className="min-w-0">
                      <Dialog.Title className="display text-h3">{title}</Dialog.Title>
                      {description ? <Dialog.Description className="mt-1 text-small text-card-soft">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
                    </div>
                    <Dialog.Close className="btn btn-sm btn-secondary shrink-0">Close</Dialog.Close>
                  </div>
                </div>
                <div className="overflow-y-auto overscroll-contain px-6 pb-8">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
