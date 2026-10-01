import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <nav aria-label="Footer" className="flex flex-wrap items-start gap-x-6 gap-y-2 text-[0.95rem] md:justify-start">
          <Link href="/sources" className="underline">Sources</Link>
          <Link href="/search" className="underline">Search</Link>
        </nav>
      </div>
    </footer>
  );
}
