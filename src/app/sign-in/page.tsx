"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register" | "magic";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [magicLink, setMagicLink] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setMagicLink("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const endpoint = mode === "magic" ? "/api/auth/magic-link" : "/api/auth/" + mode;
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const payload = await response.json() as { error?: string; developmentLink?: string };
    setPending(false);
    if (!response.ok) { setError(payload.error || "Unable to sign in."); return; }
    if (mode === "magic") { setMagicLink(payload.developmentLink || "Check your email for a secure sign-in link."); return; }
    router.push("/");
  }

  const magic = mode === "magic";
  return <main className="auth-page"><div className="auth-card"><Image src="/logo.png" alt="Routivity" width={190} height={68} priority/><span className="section-label">{magic ? "MAGIC LINK" : mode === "login" ? "WELCOME BACK" : "START YOUR NEXT TRIP"}</span><h1>{magic ? "No password to remember." : mode === "login" ? "Back to the good stuff." : "Trips are better together."}</h1><p>One calm place for the route, the people, and everything you spend along the way.</p><form onSubmit={submit}>{mode === "register" && <label>Name<input name="name" required autoComplete="name" /></label>}<label>Email<input name="email" required type="email" autoComplete="email" /></label>{!magic && <label>Password<input name="password" required type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}{error && <div className="auth-error">{error}</div>}{magicLink && <div className="invite-result">{magicLink.startsWith("http") ? <a href={magicLink}>Open your sign-in link</a> : magicLink}</div>}<button className="auth-submit" disabled={pending}>{pending ? "Working…" : magic ? "Email me a sign-in link" : mode === "login" ? "Sign in" : "Create account"}</button></form><button className="auth-switch" onClick={() => { setMode(magic ? "login" : "magic"); setError(""); setMagicLink(""); }}>{magic ? "Use a password instead" : "Sign in with a magic link"}</button><button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMagicLink(""); }}>{mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button></div></main>;
}
