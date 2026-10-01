import type { Metadata } from "next";
import Link from "next/link";
import method from "../../../data/method.json";
import { ayatList, entries, namedVerses } from "@/lib/entries";
import { EntryDisclosure } from "@/components/EntryDisclosure";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Self-Ruqyah" };

// The dataset joins the narrator and the text with a bare colon.
const tidy = (s: string) => s.replace(/^([^:]{1,60}):(?=\S)/, "$1: ");

const hadithDuas = entries.filter((e) => e.collection === "core" && e.source.book !== "The Qur'an" && /^(dua-031|dua-032|dua-033)$/.test(e.id));

export default function SelfRuqyah() {
  return (
    <PageShell width="wide">
      <h1 className="t-h1">Self-Ruqyah</h1>
      <p className="mt-2 max-w-[56ch] text-ink-soft">
        Reciting for yourself, from texts you can check. Every passage below opens with its source.
      </p>

      <section className="mt-12" aria-labelledby="method-title">
        <h2 id="method-title" className="t-h2">How it was done</h2>
        <p className="mt-2 max-w-[56ch] text-ink-soft">Two reports of the Prophet&apos;s practice, quoted as they appear in the collections.</p>
        <ul className="mt-5 grid gap-4">
          {method.map((m) => (
            <li key={m.ref} className="glass rounded-[28px] border border-line px-5 py-5 text-card-ink">
              <p className="text-small text-card-soft">{m.note}</p>
              <blockquote className="mt-2 max-w-[65ch] text-lead leading-relaxed">{tidy(m.english)}</blockquote>
              <p className="mt-2 text-meta text-card-soft">
                {m.label} {m.ref}, {m.chapter}.{" "}
                <a href={m.takhrij_url} target="_blank" rel="noreferrer" className="underline">Check the original</a>
              </p>
            </li>
          ))}
        </ul>
      </section>

      {ayatList.length > 0 && (
        <section className="mt-14" aria-labelledby="ayat-title">
          <h2 id="ayat-title" className="t-h2">Ruqyah ayat</h2>
          <p className="mt-2 max-w-[56ch] text-ink-soft">
            The passages in the ayat list, with the Arabic taken from the Qur&apos;an text on Quran.com. Open one to recite it.
          </p>
          <div className="mt-5 border-t border-line">
            {ayatList.map((e) => <EntryDisclosure key={e.id} entry={e} />)}
          </div>
        </section>
      )}

      {(hadithDuas.length > 0 || namedVerses.length > 0) && (
        <section className="mt-14" aria-labelledby="duas-title">
          <h2 id="duas-title" className="t-h2">Duas and verses</h2>
          <p className="mt-2 max-w-[56ch] text-ink-soft">
            Each is a Qur&apos;an verse or a reported supplication with a reference.
          </p>
          <div className="mt-5 border-t border-line">
            {hadithDuas.map((e) => <EntryDisclosure key={e.id} entry={e} />)}
            {namedVerses.map((e) => <EntryDisclosure key={e.id} entry={e} />)}
          </div>
        </section>
      )}

      <p className="mt-12 text-small text-ink-soft">
        More to recite: <Link href="/recitations" className="underline">the swipe deck</Link> for daily protection, or{" "}
        <Link href="/sources" className="underline">every source in one list</Link>.
      </p>
    </PageShell>
  );
}
