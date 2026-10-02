"use client";
import { useState, type FormEvent } from "react";
import { ACCOUNTS_CONFIGURED, deleteAccount, signIn, signOut, signUp, syncNow, useAccount, type AuthResult } from "@/lib/account";

const MESSAGE: Record<Exclude<AuthResult, "ok">, string> = {
  weak: "Use a password of at least 8 characters.",
  invalid: "That username and password do not match.",
  locked: "Too many tries. Please wait 15 minutes, then try again.",
  code: "That invite code is not right.",
  taken: "That username is taken. Try another.",
  username: "A username is 3 to 30 letters, numbers, dots, dashes or underscores.",
  full: "Accounts are full right now.",
  network: "The server could not be reached. Check your connection and try again.",
};

const timeText = (ms?: number) =>
  ms ? new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "not yet";

export function AccountSettings() {
  const account = useAccount();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  if (!ACCOUNTS_CONFIGURED) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote("");
    const r = mode === "up" ? await signUp(username, password, code) : await signIn(username, password);
    setBusy(false);
    if (r === "ok") { setPassword(""); setCode(""); setUsername(""); } else setNote(MESSAGE[r]);
  };

  const sync = async () => {
    setBusy(true);
    setNote("");
    const r = await syncNow();
    setBusy(false);
    setNote(r === "ok" ? "Up to date." : r === "expired" ? "Your sign-in expired. Please sign in again." : "Could not sync just now. It will try again.");
  };

  const leave = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    setMode("in");
    setNote("");
  };

  const remove = async () => {
    setBusy(true);
    const r = await deleteAccount();
    setBusy(false);
    setConfirming(false);
    setMode("in");
    setNote(r === "ok" ? "Your account was deleted. Your progress on this device is untouched." : MESSAGE.network);
  };

  return (
    <section aria-labelledby="account-title">
      <h2 id="account-title" className="t-h2">Account</h2>
      <p className="mt-2 max-w-[56ch] text-ink-soft">
        Optional. Sign in on each device to see the same reading days, streak, bookmarks and place everywhere.
      </p>

      {account.token ? (
        <div className="mt-4 glass rounded-[28px] border border-line p-5 text-card-ink">
          <p className="display text-title leading-tight">Signed in as <span className="break-all">{account.username}</span></p>
          <p className="mt-1 text-small text-card-soft">Last synced <span className="tabular">{timeText(account.at)}</span>.</p>
          {account.err === "network" && <p role="status" className="mt-2 text-small">Could not sync just now. It will try again.</p>}
          {note && <p role="status" aria-live="polite" className="mt-2 text-small">{note}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={sync} disabled={busy} className="btn btn-sm btn-secondary">{busy ? "Syncing…" : "Sync now"}</button>
            <button onClick={leave} disabled={busy} className="btn btn-sm btn-secondary">Sign out</button>
            {!confirming && <button onClick={() => setConfirming(true)} disabled={busy} className="btn btn-sm btn-secondary">Delete account</button>}
          </div>
          {confirming && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-small">Delete this account and the copy of your progress saved on the server? Your progress on this device stays.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button onClick={remove} disabled={busy} className="btn btn-sm btn-primary">Yes, delete it</button>
                <button onClick={() => setConfirming(false)} disabled={busy} className="btn btn-sm btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <div className="flex rounded-full border border-line p-1" role="group" aria-label="Sign in or create an account">
            {(["in", "up"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => { setMode(m); setNote(""); }}
                className={`min-h-11 flex-1 rounded-full text-base font-semibold transition-colors ${mode === m ? "bg-accent text-accent-ink" : ""}`}
              >
                {m === "in" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
          <label className="grid gap-1">
            <span className="text-small">Username</span>
            <input
              className="field" name="username" value={username} onChange={(e) => setUsername(e.target.value)}
              autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required minLength={3} maxLength={30}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-small">Password</span>
            <input
              className="field" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "up" ? "new-password" : "current-password"} required minLength={8}
            />
          </label>
          {mode === "up" && (
            <label className="grid gap-1">
              <span className="text-small">Invite code</span>
              <input className="field" name="invite" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
            </label>
          )}
          {account.err === "expired" && !note && <p role="status" className="text-small">Your sign-in expired. Please sign in again.</p>}
          {note && <p role="alert" className="text-small">{note}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? (mode === "up" ? "Creating…" : "Signing in…") : mode === "up" ? "Create account" : "Sign in"}
          </button>
        </form>
      )}

      <p className="mt-4 max-w-[56ch] text-small text-ink-soft">
        An account keeps a copy of your reading days, streak, bookmarks, place in the Qur&apos;an, today&apos;s ticks and reading settings on a small server, so each device you sign in on shows the same progress. It is stored under your username with no email, and your password never leaves your phone in readable form. There is no way to reset a forgotten password by yourself. Your location and reminders are not part of it.
      </p>
    </section>
  );
}
