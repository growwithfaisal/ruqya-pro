import type { Metadata } from "next";
import { QuranHome } from "@/components/QuranHome";

export const metadata: Metadata = { title: "Qur'an" };

export default function QuranPage() {
  return <QuranHome />;
}
