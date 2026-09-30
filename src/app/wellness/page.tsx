import type { Metadata } from "next";
import { PendingPage } from "@/components/PendingPage";

export const metadata: Metadata = { title: "Wellness" };

export default function Page() {
  return <PendingPage title="Wellness" blurb="Medical care first, then the Sunnah elements" />;
}
