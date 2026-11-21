"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function NewTripPage() {
  const router = useRouter(); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); const data = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.name, startDate: data.startDate, endDate: data.endDate, timezone: data.timezone, members: data.memberEmail ? [{ name: String(data.memberName || data.memberEmail), email: data.memberEmail }] : [] }) }); const body = await response.json() as { id?: string; error?: string }; setPending(false); if (!response.ok) setError(body.error || "Unable to create trip."); else router.push(body.id ? "/?trip=" + body.id : "/"); }
  return <main className="auth-page"><div className="auth-card"><Image src="/logo.png" alt="Routivity" width={190} height={68}/><span className="section-label">NEW TRIP</span><h1>Give the ride a shape.</h1><p>Start with the dates and timezone. You can refine the itinerary or import a CSV next.</p><form onSubmit={submit}><label>Trip name<input name="name" placeholder="Hampi loop" required/></label><label>Start date<input name="startDate" type="date" required/></label><label>End date<input name="endDate" type="date" required/></label><label>Trip timezone<select name="timezone" defaultValue="Asia/Kolkata"><option value="Asia/Kolkata">India — Kolkata</option><option value="Asia/Dubai">UAE — Dubai</option><option value="Europe/London">UK — London</option></select></label><label>First member name<input name="memberName" placeholder="Optional"/></label><label>First member email<input name="memberEmail" type="email" placeholder="Optional"/></label>{error && <div className="auth-error">{error}</div>}<button className="auth-submit" disabled={pending}>{pending ? "Creating…" : "Create trip"}</button></form></div></main>;
}
