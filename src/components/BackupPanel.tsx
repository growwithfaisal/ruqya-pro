"use client";
import { useEffect, useRef, useState } from "react";
import { restoreBackup, saveBackup, summaryNow } from "@/lib/backup";
import { useQuran } from "@/lib/quran-store";

export function BackupPanel() {
  const q = useQuran(); // re-render when progress changes
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [counts, setCounts] = useState({ days: 0, marks: 0, hasPlace: false });
  useEffect(() => setCounts(summaryNow()), [q.days, q.marks, q.last]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await saveBackup();
      setMsg("Backup ready. Keep the file somewhere safe, such as Files or iCloud Drive.");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMsg("The backup could not be made on this device.");
    }
    setBusy(false);
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const s = await restoreBackup(file);
      setMsg(`Restored. You now have ${s.days} reading ${s.days === 1 ? "day" : "days"} and ${s.marks} ${s.marks === 1 ? "bookmark" : "bookmarks"}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "That file could not be restored.");
    }
    if (input.current) input.current.value = "";
    setBusy(false);
  };

  return (
    <section aria-labelledby="backup-title">
      <h2 id="backup-title" className="t-h2">Your progress</h2>
      <p className="mt-2 max-w-[56ch] text-ink-soft">
        Your reading days, streak, bookmarks and place live only on this device. Deleting the app removes them. Save a backup file before you delete or switch phones, then restore it in the new copy.
      </p>
      <div className="mt-6 glass rounded-[28px] border border-line p-5 text-card-ink">
        <p className="text-small text-card-soft">
          On this device now: {counts.days} reading {counts.days === 1 ? "day" : "days"}, {counts.marks} {counts.marks === 1 ? "bookmark" : "bookmarks"}{counts.hasPlace ? ", and your place in the Qur'an" : ""}.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={save} disabled={busy} className="btn btn-primary w-full sm:w-auto sm:flex-1">
            Save a backup
          </button>
          <button onClick={() => input.current?.click()} disabled={busy} className="btn btn-secondary w-full sm:w-auto sm:flex-1">
            Restore from a backup
          </button>
          <input ref={input} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => restore(e.target.files?.[0])} />
        </div>
        {msg && <p role="status" aria-live="polite" className="mt-4 text-small">{msg}</p>}
      </div>
    </section>
  );
}
