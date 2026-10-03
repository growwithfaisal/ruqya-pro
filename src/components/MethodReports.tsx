"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Chevron } from "./Glyphs";

export interface Report { label: string; ref: string; chapter: string; note: string; english: string; takhrij_url: string }

// The dataset joins the narrator and the text with a bare colon.
const tidy = (s: string) => s.replace(/^([^:]{1,60}):(?=\S)/, "$1: ");
const COLLAPSED = 92; // px: about three lines of the quote

function Card({ r, children }: { r: Report; children: React.ReactNode }) {
  return (
    <div className="glass rounded-[28px] border border-line px-5 py-5 text-card-ink">
      <p className="text-small text-card-soft">{r.note}</p>
      {children}
      <p className="mt-2 text-meta text-card-soft">
        {r.label} {r.ref}, {r.chapter}.{" "}
        <a href={r.takhrij_url} target="_blank" rel="noreferrer" className="underline">Check the original</a>
      </p>
    </div>
  );
}

/**
 * The two reports of the Prophet's practice, short until the reader asks for more: the first shows about three lines of its
 * quote under a soft fade, the second is folded away. One button opens both together and says which way it will go.
 * The quote is never shortened; the reference and the link to the original stay in view either way.
 */
export function MethodReports({ reports }: { reports: Report[] }) {
  const [first, ...rest] = reports;
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState<number | "auto">(COLLAPSED);
  const quote = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    const el = quote.current;
    if (!el) return;
    if (open) {
      setHeight(el.scrollHeight);
      const t = setTimeout(() => setHeight("auto"), 520); // let the text reflow freely once open (larger text, rotation)
      return () => clearTimeout(t);
    }
    setHeight(el.scrollHeight); // from "auto" a transition needs a number to start from
    const f = requestAnimationFrame(() => requestAnimationFrame(() => setHeight(COLLAPSED)));
    return () => cancelAnimationFrame(f);
  }, [open]);

  if (!first) return null;
  return (
    <section className="mt-14" aria-labelledby="method-title">
      <h2 id="method-title" className="t-h2">How it was done</h2>
      <p className="mt-2 max-w-[56ch] text-ink-soft">Two reports of the Prophet&apos;s practice, quoted from the collections.</p>

      <div className="mt-5 grid gap-4">
        <Card r={first}>
          <div className="relative mt-2">
            <div
              ref={quote}
              id={`${id}-quote`}
              className="overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{ maxHeight: height === "auto" ? "none" : height }}
            >
              <blockquote className="max-w-[65ch] text-lead leading-relaxed">{tidy(first.english)}</blockquote>
            </div>
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[color-mix(in_oklch,var(--card)_92%,transparent)] to-transparent transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-0" : "opacity-100"}`}
            />
          </div>
        </Card>

        {rest.length > 0 && (
          <div
            id={`${id}-more`}
            className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            inert={!open}
          >
            <div className="overflow-hidden">
              <ul className="grid gap-4">
                {rest.map((r) => (
                  <li key={r.ref}>
                    <Card r={r}><blockquote className="mt-2 max-w-[65ch] text-lead leading-relaxed">{tidy(r.english)}</blockquote></Card>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-quote ${id}-more`}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-5 text-small font-semibold"
      >
        {open ? "Show less" : "Show more"}
        <Chevron size={18} className={`transition-transform duration-300 motion-reduce:transition-none ${open ? "-rotate-90" : "rotate-90"}`} />
      </button>
    </section>
  );
}
