"use client";
import { useEffect, useState } from "react";
import { OfflineRecord, downloadEverything, readRecord, removeEverything } from "@/lib/offline";
import { Check, CloudDown } from "./Glyphs";

const mb = (b: number) => `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`;

export function OfflinePanel({ pages }: { pages: string[] }) {
  const [rec, setRec] = useState<OfflineRecord | null>(null);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [used, setUsed] = useState<number | null>(null);

  const refresh = () => {
    setRec(readRecord());
    navigator.storage?.estimate?.().then((e) => setUsed(e.usage ?? null)).catch(() => {});
  };
  useEffect(() => {
    refresh();
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("rp-offline", refresh);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("rp-offline", refresh); };
  }, []);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadEverything(pages, (done, total) => setProgress({ done, total }));
    } catch (e) {
      setError(e instanceof Error && e.message.includes("cannot keep") ? e.message : "The download stopped before it finished. Check your connection and free space, then try again.");
    }
    setBusy(false);
    refresh();
  };

  const remove = async () => {
    setBusy(true);
    await removeEverything();
    setBusy(false);
    refresh();
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section aria-labelledby="offline-title">
      <h2 id="offline-title" className="t-h2">Use without internet</h2>
      <p className="mt-2 max-w-[56ch] text-ink-soft">
        Download the whole app once: every page, the daily routines, all recitations and the entire Qur&apos;an. After that it opens with no connection. Everything stays on this device.
      </p>

      <div className="mt-6 glass rounded-[28px] border border-line p-5 text-card-ink">
        {rec && !busy ? (
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"><Check size={24} /></span>
            <div className="min-w-0 flex-[1_1_9rem]">
              <p className="display text-title leading-tight">Everything is on this device</p>
              <p className="mt-1 text-small text-card-soft">
                {rec.files} files · {mb(rec.bytes)} · updated {new Date(rec.at).toLocaleDateString(undefined, { day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full border border-line"><CloudDown size={26} /></span>
            <div className="min-w-0 flex-[1_1_9rem]">
              <p className="display text-title leading-tight">{busy ? "Downloading…" : "Not downloaded yet"}</p>
              <p className="mt-1 text-small text-card-soft">About 8 MB. Best over Wi-Fi.</p>
            </div>
          </div>
        )}

        {busy && (
          <div className="mt-5" role="status" aria-live="polite">
            <div className="h-2.5 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--card-ink)_14%,transparent)]">
              <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-meta text-card-soft">{progress.done} of {progress.total} files · {pct}%</p>
          </div>
        )}

        {error && <p className="mt-4 text-small" role="alert">{error}</p>}
        {!online && !busy && <p className="mt-4 text-small text-card-soft">You are offline now. Connect to download or update.</p>}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={start}
            disabled={busy || !online}
            className="btn btn-primary flex-1"
          >
            {busy ? "Downloading…" : rec ? "Update the download" : "Download everything"}
          </button>
          {rec && !busy && (
            <button onClick={remove} className="btn btn-secondary">Remove</button>
          )}
        </div>
        {used !== null && <p className="mt-4 text-meta text-card-soft">This app uses {mb(used)} on this device.</p>}
      </div>
      {rec && (
        <p className="mt-3 max-w-[56ch] text-meta text-ink-soft">
          When a new version of the app is released, your download is refreshed by itself the next time you open the app with a connection.
        </p>
      )}
    </section>
  );
}
