"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MORE, isActive } from "@/lib/nav";
import { Book, Chevron, Dots, Horizon, Niche, Star8 } from "./Glyphs";
import { Sheet } from "./Sheet";

const TABS = [
  { href: "/", label: "Home", Icon: Horizon },
  { href: "/quran", label: "Qur'an", Icon: Book },
  { href: "/recitations", label: "Recitations", Icon: Star8 },
  { href: "/self-ruqyah", label: "Self-Ruqyah", Icon: Niche },
] as const;

/**
 * The phone's way around the app: one tap to any of the four main places, and "More" for the rest.
 * Hidden on the reading screens, which own the bottom edge with their own controls.
 */
export function TabBar() {
  const path = usePathname();
  const params = useSearchParams();
  const [more, setMore] = useState(false);
  const immersive = path.startsWith("/quran/read") || (path === "/recitations" && params.has("set"));

  useEffect(() => {
    const root = document.documentElement.classList;
    root.toggle("has-tabbar", !immersive);
    root.toggle("rp-immersive", immersive);
    return () => { root.remove("has-tabbar"); root.remove("rp-immersive"); };
  }, [immersive]);

  if (immersive) return null;
  const moreActive = MORE.some((m) => isActive(path, m.href));

  return (
    <>
      <nav aria-label="Main" className="tabbar glass-bar border-t border-line lg:hidden">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map(({ href, label, Icon }) => {
            const on = isActive(path, href);
            return (
              <li key={href}>
                <Link href={href} aria-label={label} aria-current={on ? "page" : undefined} className={`tab ${on ? "tab-on" : ""}`}>
                  <span className="tab-icon"><Icon size={22} /></span>
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMore(true)} aria-label="More" aria-haspopup="dialog" className={`tab w-full ${moreActive ? "tab-on" : ""}`}>
              <span className="tab-icon"><Dots size={22} /></span>
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={more} onOpenChange={setMore} title="More" description="Sources, search and settings.">
        <nav aria-label="More" className="grid">
          {MORE.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMore(false)}
              aria-current={isActive(path, n.href) ? "page" : undefined}
              className="flex min-h-14 items-center justify-between border-t border-line text-lead no-underline"
            >
              {n.label}
              <Chevron className="text-card-soft" />
            </Link>
          ))}
        </nav>
      </Sheet>
    </>
  );
}

