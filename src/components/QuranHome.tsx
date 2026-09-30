"use client";
import Link from "next/link";
import { useState } from "react";
import { chapter, chapters, readHref, surahUrl } from "@/lib/quran";
import { useOffline, useQuran } from "@/lib/quran-store";
import { ChapterList } from "./ChapterList";
import { Chevron } from "./Glyphs";
import { StreakPill, WeekRow } from "./Streak";

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
    <div className="mx-auto max-w-2xl px-4 pb-4 pt-8 md:px-8 md:pt-12">
      <h1 className="display text-[clamp(2rem,6vw,3rem)] leading-tight">Qur&apos;an</h1>
      <p className="mt-2 max-w-[52ch] text-ink-soft">Read a surah verse by verse. Your place and reading days stay on this device.</p>

      <div className="mt-6 grid gap-3">
        <StreakPill />
        <WeekRow />
      </div>

      {q.last && (
        <Link
          href={readHref(q.last.surah, q.last.verse)}
          className="group mt-5 flex min-h-[4.5rem] items-center gap-4 rounded-[28px] bg-accent px-5 py-3 text-accent-ink no-underline transition-transform duration-200 active:scale-[0.98]"
        >
          <span className="grid flex-1">
            <span className="text-[0.9rem] opacity-90">Continue reading</span>
            <span className="display text-[1.35rem] leading-tight">{chapter(q.last.surah).name} <span className="tabular">{q.last.surah}:{q.last.verse}</span></span>
          </span>
          <Chevron className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      )}

      <div className="mt-8">
        <ChapterList />
      </div>

      <div className="mt-8 border-t border-line pt-5 text-[0.95rem] text-ink-soft">
        <p>Saved surahs open without a connection. The whole Qur&apos;an is about 3 MB.</p>
        <button
          onClick={saveAll}
          disabled={saving || left.length === 0}
          className="mt-3 min-h-11 rounded-full border border-line px-5 text-ink disabled:opacity-50"
        >
          {left.length === 0 ? "Everything is saved" : saving ? "Saving…" : `Save all ${left.length} for offline`}
        </button>
        {msg && <p className="mt-2" role="status">{msg}</p>}
      </div>
    </div>
  );
}
