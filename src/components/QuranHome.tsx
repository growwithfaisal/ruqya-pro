"use client";
import Link from "next/link";
import { useState } from "react";
import { chapter, chapters, readHref, surahUrl } from "@/lib/quran";
import { useOffline, useQuran } from "@/lib/quran-store";
import { ChapterList } from "./ChapterList";
import { Chevron } from "./Glyphs";
import { StreakPill, WeekRow } from "./Streak";
import { PageShell } from "@/components/PageShell";

export function QuranHome() {
  const q = useQuran();
  const off = useOffline();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const left = chapters.filter((c) => !off.offline.has(c.id)).map((c) => c.id);

  const saveAll = async () => {
    setSaving(true);
    setMsg("");
    const ok = await off.save(left, surahUrl);
    setSaving(false);
    setMsg(ok ? "The whole Qur'an is saved on this device." : "Could not save everything. Check your connection and free space, then try again.");
  };

  return (
    <PageShell>
      <h1 className="t-h1">Qur&apos;an</h1>
      <p className="mt-2 max-w-[52ch] text-ink-soft">Read a surah verse by verse. Your place and reading days stay on this device.</p>

      <div className="mt-6 grid gap-3">
        <StreakPill />
        <WeekRow />
      </div>

      {q.last && (
        <Link
          href={readHref(q.last.surah, q.last.verse)}
          className="cta cta-solid group mt-5"
        >
          <span className="grid flex-1">
            <span className="text-meta opacity-90">Continue reading</span>
            <span className="display text-title leading-tight">{chapter(q.last.surah).name} <span className="tabular">{q.last.surah}:{q.last.verse}</span></span>
          </span>
          <Chevron className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      )}

      <div className="mt-8">
        <ChapterList />
      </div>

      <div className="mt-8 border-t border-line pt-5 text-small text-ink-soft">
        <p>Saved surahs open without a connection. The whole Qur&apos;an is about 3 MB.</p>
        <button
          onClick={saveAll}
          disabled={saving || left.length === 0}
          className="btn btn-sm btn-secondary mt-3 text-ink"
        >
          {left.length === 0 ? "Everything is saved" : saving ? "Saving…" : `Save all ${left.length} for offline`}
        </button>
        {msg && <p className="mt-2" role="status">{msg}</p>}
      </div>
    </PageShell>
  );
}
