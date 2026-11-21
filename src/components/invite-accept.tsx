"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function InviteAccept({ token }: { token: string }) {
  const router = useRouter(); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function accept() {
    setPending(true); const response = await fetch("/api/invite/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); const body = await response.json() as { error?: string; tripId?: string }; setPending(false);
    if (!response.ok) { setError(body.error || "This invite is no longer available."); return; }
    router.push(body.tripId ? "/?trip=" + body.tripId : "/");
  }
  return <main className="auth-page"><div className="auth-card"><Image src="/logo.png" alt="Routivity" width={190} height={68}/><span className="section-label">YOU’RE INVITED</span><h1>Come ride with us.</h1><p>Accept this invite to join the trip and see the route, people, and shared updates.</p>{error && <div className="auth-error">{error}</div>}<button className="auth-submit" onClick={() => void accept()} disabled={pending}>{pending ? "Joining…" : "Accept invitation"}</button><button className="auth-switch" onClick={() => router.push("/sign-in")}>Sign in first</button></div></main>;
}
