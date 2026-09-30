import Link from "next/link";
import { Disclaimer } from "./Disclaimer";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-[1.4fr_1fr] md:px-8">
        <Disclaimer />
        <nav aria-label="Footer" className="flex flex-wrap items-start gap-x-6 gap-y-2 text-[0.95rem] md:justify-end">
          <Link href="/sources" className="underline">Sources</Link>
          <Link href="/search" className="underline">Search</Link>
        </nav>
      </div>
    </footer>
  );
}
