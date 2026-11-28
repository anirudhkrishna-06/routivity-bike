"use client";
import { FormEvent, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export function ParentAccessScreen({ shareToken, onAccess }: { shareToken: string; onAccess: () => void }) {
  const [passcode, setPasscode] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const response = await fetch(`/api/trip-watch/${shareToken}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "Unable to open this link."); onAccess(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to open this link."); }
    finally { setBusy(false); }
  }
  return <main className="trip-watch-access"><div className="trip-watch-access-card"><div className="trip-watch-mark"><LockKeyhole size={22} /></div><h1>You’re invited to follow a journey.</h1><p>Enter the private passcode shared with you to see the latest trip status, last reported location and itinerary.</p><form onSubmit={submit}><label htmlFor="watch-passcode">Passcode</label><div className="trip-watch-password"><input id="watch-passcode" type={show ? "text" : "password"} value={passcode} onChange={(event) => setPasscode(event.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setShow((value) => !value)}>{show ? "Hide" : "Show"}</button></div>{error && <div className="trip-watch-error" role="alert">{error}</div>}<button className="trip-watch-primary" disabled={busy}>{busy ? "Checking…" : "Continue"}</button></form><small><ShieldCheck size={13} /> Private, read-only access · No financial information is shared</small></div></main>;
}
