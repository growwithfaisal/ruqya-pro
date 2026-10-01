import type { ReactNode } from "react";

const WIDTH = { narrow: "max-w-2xl", wide: "max-w-3xl", deck: "max-w-5xl" } as const;

/**
 * The frame every page shares: one centred column, one gutter, one top space.
 * narrow: app screens (Qur'an, Settings, Search, a single recitation). wide: reference pages (Self-Ruqyah, Sources). deck: the swipe deck.
 */
export function PageShell({
  width = "narrow", as: Tag = "div", className = "", children,
}: { width?: keyof typeof WIDTH; as?: "div" | "article"; className?: string; children: ReactNode }) {
  return <Tag className={`page-shell mx-auto ${WIDTH[width]} px-4 pb-4 pt-8 md:px-8 md:pt-12 ${className}`}>{children}</Tag>;
}
