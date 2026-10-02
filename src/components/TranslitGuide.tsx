"use client";
import { useState, type ReactNode } from "react";
import { Chevron } from "./Glyphs";
import { Sheet } from "./Sheet";
import { MARK_SILENT, MARK_UNDERLINE } from "./Translit";

/* Examples are drawn with the same styles as the verses (see Translit.tsx), so what the reader learns here is what they see there. */
const U = ({ children }: { children: ReactNode }) => <span className={MARK_UNDERLINE}>{children}</span>;
const F = ({ children }: { children: ReactNode }) => <span className={MARK_SILENT}>{children}</span>;
const ar = "font-[family-name:var(--font-arabic)] text-[1.35rem] leading-none";

function Item({ label, example, say, children }: { label: string; example: ReactNode; say: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-5">
      <h3 className="text-small font-semibold">{label}</h3>
      <p className="mt-2 text-[1.45rem] leading-snug" role="img" aria-label={say}>{example}</p>
      <p className="mt-2 max-w-[56ch] text-card-soft">{children}</p>
    </section>
  );
}

function Pair({ plain, strong, arPlain, arStrong, note }: { plain: string; strong: string; arPlain: string; arStrong: string; note: string }) {
  return (
    <li className="grid grid-cols-[3.2rem_1fr] items-baseline gap-x-3 gap-y-0.5 py-2">
      <span className="text-[1.15rem]">{plain}</span>
      <span><span lang="ar" className={ar}>{arPlain}</span> <span className="text-card-soft">plain</span></span>
      <span className="text-[1.15rem]"><U>{strong}</U></span>
      <span><span lang="ar" className={ar}>{arStrong}</span> <span className="text-card-soft">{note}</span></span>
    </li>
  );
}

/** A row for the Reading settings that opens the guide to the marks in the transliteration. */
export function TranslitGuideRow() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-line text-left">
        <span>How to read the transliteration</span>
        <Chevron className="shrink-0 opacity-60" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Reading the transliteration" description="What the underlines and faded letters mean.">
        <p className="max-w-[56ch] text-card-soft">The Latin letters are a guide to the sound. Three kinds of letter tell you how to say a word.</p>

        <div className="mt-4">
          <Item label="Plain letters" example={<>Bismi</>} say="Bismi, with no marks">
            Say them as they are written.
          </Item>

          <Item label="Underlined: say with care" example={<>Al<U>h</U>amdu lill<U>a</U>hi</>} say="Alhamdu lillahi, with the h of Alhamdu and the a of lillahi underlined">
            An underlined <strong>a</strong> is a long a, held for about two counts. An underlined <strong>consonant</strong> is the stronger of two Arabic letters that English spells the same way (see the list below).
          </Item>

          <Item
            label="Faded: written, not said"
            example={<>Bismi <F>A</F>ll<U>a</U>hi <F>al</F>rra<U>h</U>m<U>a</U>ni</>}
            say="Bismi Allahi ar-rahmani, with the A of Allahi and the al of ar-rahmani faded"
          >
            A faded letter is only dropped when you carry on reading. After <em>bismi</em> the A of Allah joins on, and the l of <em>al-</em> melts into the r after it, so you say <em>bismi llahi rrahmani</em>. If you start reading from that word, you say it in full.
          </Item>

          <Item label="Faded at the end of a verse" example={<>nukr<U>a</U><F>n</F></>} say="nukran, with the a underlined and the n faded">
            When a verse stops on an <em>-an</em> ending, the n is dropped and the a is held: <em>nukra</em>. If you carry on into the next verse, the n is said.
          </Item>
        </div>

        <section className="border-t border-line py-5" aria-labelledby="tg-letters">
          <h3 id="tg-letters" className="text-small font-semibold">Underlined letters and the Arabic letter behind them</h3>
          <ul className="mt-1 divide-y divide-[color-mix(in_oklch,var(--line)_100%,transparent)]">
            <Pair plain="h" strong="h" arPlain="ه" arStrong="ح" note="deep, from the throat" />
            <Pair plain="th" strong="th" arPlain="ث" arStrong="ذ or ظ" note="as in “this”, not “think”" />
            <Pair plain="s" strong="s" arPlain="س" arStrong="ص" note="full-mouth s" />
            <Pair plain="d" strong="d" arPlain="د" arStrong="ض" note="full-mouth d" />
            <Pair plain="t" strong="t" arPlain="ت" arStrong="ط" note="full-mouth t" />
          </ul>
        </section>

        <section className="border-t border-line py-5" aria-labelledby="tg-key">
          <h3 id="tg-key" className="text-small font-semibold">Quick key</h3>
          <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2">
            <dt className="text-[1.15rem]">AA</dt>
            <dd className="text-card-soft">The throat letter <span lang="ar" className={ar}>ع</span>.</dd>
            <dt className="text-[1.15rem]">oo, ee</dt>
            <dd className="text-card-soft">Long u and long i, held for about two counts. They are not underlined.</dd>
            <dt className="text-[1.15rem]">rr, ll, bb</dt>
            <dd className="text-card-soft">A doubled letter is held a beat longer and pressed.</dd>
            <dt className="text-[1.15rem]">kh, gh, sh</dt>
            <dd className="text-card-soft">One letter each (<span lang="ar" className={ar}>خ</span> <span lang="ar" className={ar}>غ</span> <span lang="ar" className={ar}>ش</span>).</dd>
          </dl>
        </section>

        <p className="border-t border-line pt-4 text-meta text-card-soft">
          These marks are a learning aid worked out from the Arabic text. Learn recitation from a qualified teacher.
        </p>
      </Sheet>
    </>
  );
}
