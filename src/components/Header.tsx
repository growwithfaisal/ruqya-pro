"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/lib/nav";
import { Search, Wordmark } from "./Glyphs";


export function Header() {
  const path = usePathname();
  const router = useRouter();
  // A home-screen app has no browser back button, so offer one.
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
  }, []);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header className="app-header glass-bar sticky top-0 z-30 border-b border-line short:static">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 short:py-1.5 md:px-8">
        {standalone && path !== "/" && (
          <button onClick={() => router.back()} aria-label="Back" className="-ml-2 mr-1 grid min-h-11 min-w-11 place-items-center rounded-full">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        <Link href="/" className="mr-auto flex min-h-11 items-center gap-2.5 no-underline" aria-label="RuqyaPro home">
          <Wordmark className="text-accent" />
          <span className="display text-title leading-none">RuqyaPro</span>
        </Link>

        <Link href="/search" aria-label="Search" aria-current={path.startsWith("/search") ? "page" : undefined} className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line lg:hidden">
          <Search size={20} />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-small no-underline transition-colors ${active(n.href) ? "bg-ink text-[var(--sky-bottom)]" : "hover:bg-[color-mix(in_oklch,var(--ink)_10%,transparent)]"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

      </div>
    </header>
  );
}
