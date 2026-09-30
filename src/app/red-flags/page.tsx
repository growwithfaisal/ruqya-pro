import type { Metadata } from "next";
import { PendingPage } from "@/components/PendingPage";

export const metadata: Metadata = { title: "Red Flags" };

export default function Page() {
  return <PendingPage title="Red Flags" blurb="Signs of a charlatan, and the ethics a real raqi keeps" />;
}
