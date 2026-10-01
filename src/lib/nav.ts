/** Every place in the app. The top bar (desktop) lists all of them; the tab bar (phones) lists TABS and puts MORE behind one tap. */
export const NAV = [
  { href: "/", label: "Home" },
  { href: "/quran", label: "Qur'an" },
  { href: "/self-ruqyah", label: "Self-Ruqyah" },
  { href: "/recitations", label: "Recitations" },
  { href: "/sources", label: "Sources" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
] as const;

export const TAB_HREFS = ["/", "/quran", "/recitations", "/self-ruqyah"] as const;
export const MORE = NAV.filter((n) => !(TAB_HREFS as readonly string[]).includes(n.href));

export const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));
