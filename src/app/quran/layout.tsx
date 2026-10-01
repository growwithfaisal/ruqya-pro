import type { ReactNode } from "react";
import { SurahPane } from "@/components/SurahPane";

/**
 * On phones the Qur'an is one column (list, then reader). From 1024px the surah list stays on the left and the reader or
 * the Qur'an page fills the right, so choosing a surah never leaves the page. The list is hidden with CSS below that width.
 */
export default function QuranLayout({ children }: { children: ReactNode }) {
  return (
    <div className="quran-shell">
      <aside className="quran-side" aria-label="Surahs">
        <SurahPane />
      </aside>
      <div className="quran-main">{children}</div>
    </div>
  );
}
