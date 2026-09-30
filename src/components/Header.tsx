"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Wordmark } from "./Glyphs";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/self-ruqyah", label: "Self-Ruqyah" },
  { href: "/recitations", label: "Recitations" },
  { href: "/red-flags", label: "Red Flags" },
  { href: "/wellness", label: "Wellness" },
  { href: "/sources", label: "Sources" },
  { href: "/search", label: "Search" },
];

export function Header() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header className="sticky top-0 z-30 border-b border-line" style={{ background: "var(--sky-top)" }}>
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-8">
        <Link href="/" className="flex items-center gap-2.5 no-underline" aria-label="RuqyaPro home">
          <Wordmark className="text-accent" />
          <span className="display text-[1.35rem] leading-none">RuqyaPro</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[0.95rem] no-underline transition-colors ${active(n.href) ? "bg-ink text-[var(--sky-bottom)]" : "hover:bg-[color-mix(in_oklch,var(--ink)_10%,transparent)]"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <Dialog.Root>
          <Dialog.Trigger className="min-h-11 rounded-full border border-line px-4 text-[0.95rem] lg:hidden">Menu</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="drawer-overlay fixed inset-0 z-40 bg-black/40" />
            <Dialog.Content className="drawer-panel fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border border-line bg-card p-6 pb-10 text-card-ink shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.35)]">
              <Dialog.Title className="display mb-1 text-2xl">RuqyaPro</Dialog.Title>
              <Dialog.Description className="mb-4 text-card-soft">Where to?</Dialog.Description>
              <nav aria-label="Menu" className="grid">
                {NAV.map((n) => (
                  <Dialog.Close asChild key={n.href}>
                    <Link href={n.href} aria-current={active(n.href) ? "page" : undefined} className="flex min-h-14 items-center justify-between border-t border-line text-[1.1rem] no-underline">
                      {n.label}
                      {active(n.href) && <span className="text-sm text-card-soft">Here</span>}
                    </Link>
                  </Dialog.Close>
                ))}
              </nav>
              <Dialog.Close className="mt-5 min-h-11 w-full rounded-full border border-line">Close</Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  );
}
