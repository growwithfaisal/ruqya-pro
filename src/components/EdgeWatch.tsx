"use client";
import { useEffect } from "react";

/**
 * Tells the page's chrome where the content is, so the header and tab bar draw their hairline only while something is
 * passing under them (Apple's scroll-edge effect): `data-scrolled` once the page has moved off its top, and
 * `data-more-below` while there is more page under the tab bar. Also gives iOS Safari the touchstart listener it needs
 * before it shows any :active press state.
 */
export function EdgeWatch() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      root.toggleAttribute("data-scrolled", y > 2);
      root.toggleAttribute("data-more-below", root.scrollHeight - (y + window.innerHeight) > 2);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const noop = () => {};
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("touchstart", noop, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("touchstart", noop);
      ro.disconnect();
    };
  }, []);
  return null;
}
