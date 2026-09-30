import type { Metadata } from "next";
import { Suspense } from "react";
import { QuranReader } from "@/components/QuranReader";

export const metadata: Metadata = { title: "Read" };

export default function ReadPage() {
  return (
    <Suspense fallback={<p className="px-4 pt-16 text-center text-ink-soft">Opening…</p>}>
      <QuranReader />
    </Suspense>
  );
}
