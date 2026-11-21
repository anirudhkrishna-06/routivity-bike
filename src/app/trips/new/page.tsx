"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { parseTripCsv, type ImportPreview } from "@/lib/csv";

export default function NewTripPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function chooseFile(file: File) {
    setFileName(file.name);
    setError("");
    setPreview(parseTripCsv(await file.text()));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview?.trip) { setError("Choose a valid CSV first."); return; }
    const errors = preview.issues.filter((issue) => issue.severity === "error");
    if (errors.length) { setError("Fix the CSV errors before importing."); return; }
    setPending(true); setError("");
    const payload = {
      idempotencyKey: crypto.randomUUID(),
      trip: { name: preview.trip.trip_name, startDate: preview.trip.start_date, endDate: preview.trip.end_date, timezone: preview.trip.timezone || "Asia/Kolkata", currency: preview.trip.currency || "INR" },
      members: preview.members.map((member) => ({ name: member.member_name, email: member.member_email || undefined })),
      activities: preview.activities.map((activity) => ({ type: activity.activity_type as "TRAVEL" | "STAY" | "EXPLORATION" | "CUSTOM", title: activity.title, date: activity.date, startTime: activity.start_time || undefined, endTime: activity.end_time || undefined, origin: activity.origin || undefined, destination: activity.destination || undefined, location: activity.location || undefined, viaPoints: activity.via_points || undefined, mapsUrl: activity.maps_url || undefined, status: (activity.status || "planned") as "planned" | "done" | "skipped" })),
    };
    const response = await fetch("/api/trips/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json() as { tripId?: string; error?: string };
    setPending(false);
    if (!response.ok) { setError(body.error || "Import failed. Nothing was saved."); return; }
    router.push("/?trip=" + body.tripId);
    router.refresh();
  }

  return <main className="auth-page"><div className="auth-card import-trip-card"><Image src="/logo.png" alt="Routivity" width={190} height={68} priority/><span className="section-label">CREATE FROM CSV</span><h1>Bring the whole trip in.</h1><p>One file creates the trip, members, days, and itinerary together. Nothing is saved until you confirm the preview.</p><label className="csv-picker"><input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void chooseFile(file); }}/><b>{fileName || "Choose your itinerary CSV"}</b><small>Use the Routivity template or your own matching CSV.</small></label>{preview && <div className="csv-summary"><strong>{preview.trip?.trip_name || "Untitled trip"}</strong><span>{preview.members.length} members · {preview.activities.length} activities</span>{preview.issues.slice(0, 6).map((issue, index) => <small className={issue.severity === "error" ? "csv-error" : "csv-warning"} key={index}>Row {issue.row}, {issue.column}: {issue.message}</small>)}</div>}{error && <div className="auth-error">{error}</div>}<form onSubmit={submit}><button className="auth-submit" disabled={pending || !preview}>{pending ? "Saving trip…" : "Create trip from CSV"}</button></form><a className="auth-switch" href="/templates/routivity-sample.csv" download>Download the sample template</a></div></main>;
}
