import type { Metadata } from "next";
import Link from "next/link";
import method from "../../../data/method.json";
import { entries } from "@/lib/entries";
import { preparation, ruqyahAyat, ruqyahDuas } from "@/lib/library";
import { EntryDisclosure } from "@/components/EntryDisclosure";
import { MethodReports } from "@/components/MethodReports";
import { PageShell } from "@/components/PageShell";
import { Preparation } from "@/components/Preparation";

export const metadata: Metadata = { title: "Self-Ruqyah" };

export default function SelfRuqyah() {
  const ayat = ruqyahAyat();
  const duas = ruqyahDuas();

  return (
    <PageShell width="wide">
      <h1 className="t-h1">Self-Ruqyah</h1>
      <p className="mt-2 max-w-[56ch] text-ink-soft">
        Reciting for yourself, from texts you can check. Every passage below opens with its source.
      </p>

      <Preparation steps={preparation} entries={entries} />

      <MethodReports reports={method} />

      {ayat.length > 0 && (
        <section className="mt-14" aria-labelledby="ayat-title">
          <h2 id="ayat-title" className="t-h2">Ruqyah Ayats</h2>
          <p className="mt-2 max-w-[56ch] text-ink-soft">Open one to recite it. A number beside a passage is how many times, and where it comes from.</p>
          <div className="mt-5 border-t border-line">
            {ayat.map((e) => <EntryDisclosure key={e.id} entry={e} />)}
          </div>
        </section>
      )}

      {duas.length > 0 && (
        <section className="mt-14" aria-labelledby="duas-title">
          <h2 id="duas-title" className="t-h2">Ruqyah Duas</h2>
          <p className="mt-2 max-w-[56ch] text-ink-soft">Each is a reported supplication with a reference.</p>
          <div className="mt-5 border-t border-line">
            {duas.map((e) => <EntryDisclosure key={e.id} entry={e} />)}
          </div>
        </section>
      )}

      <p className="mt-12 text-small text-ink-soft">
        More to recite: <Link href="/recitations" className="underline">Recitations</Link> for daily protection, pain, the evil eye, provision and worry, or{" "}
        <Link href="/sources" className="underline">every source in one list</Link>.
      </p>
    </PageShell>
  );
}
