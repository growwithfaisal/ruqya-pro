"use client";
import { ChapterList } from "./ChapterList";

/** The surah list kept beside the reader on wide screens (hidden by CSS below 1024px). */
export function SurahPane() {
  return (
    <div className="px-1 pb-6">
      <p className="display mb-3 text-title">Surahs</p>
      <ChapterList />
    </div>
  );
}
