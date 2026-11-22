"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Copy, Download, Sparkles } from "lucide-react";
import { parseTripCsv, type ImportPreview } from "@/lib/csv";

const AI_PROMPT_TEMPLATE = `Act as a travel itinerary assistant. Generate a single CSV file formatted for the Routivity travel planner based on my trip details.

MY TRIP DETAILS:
- Trip Name: [e.g. Bangalore-Hampi-Goa Bike Loop]
- Dates: [e.g. 2026-11-25 to 2026-11-27]
- Creator / Lead: [Your Name]
- Riders / Members: [Names and optional emails, e.g. Rohan (rohan@example.com), Vikram, Ananya]
- Budget estimates: [e.g. Fuel ₹4500, Stay ₹6000, Food ₹3600]
- Itinerary overview: [e.g. Day 1 ride from Bangalore to Hampi via NH48, Day 2 explore Hampi temples, Day 3 ride through Western Ghats to Vagator Beach Goa]

CSV FORMAT REQUIREMENTS:
The CSV must start with this exact header:
record_type,trip_name,start_date,end_date,creator_name,currency,timezone,member_id,member_name,member_email,category,budget_type,planned_amount,applicable_to,day_number,date,activity_type,title,start_time,end_time,origin,destination,location,via_points,maps_url,bike_id,status,notes

Rules:
1. First row after header must be a TRIP row:
   TRIP,<trip_name>,<YYYY-MM-DD>,<YYYY-MM-DD>,<creator_name>,INR,Asia/Kolkata,,,,,,,,,,,,,,,,,,,<notes>
2. Followed by MEMBER rows:
   MEMBER,,,,,,,M1,<Name>,<Email>,,,,,,,,,,,,,,,,,,
   MEMBER,,,,,,,M2,<Name>,<Email>,,,,,,,,,,,,,,,,,,
3. Followed by BUDGET rows (categories: Fuel, Stay, Food, Parking, Tickets, Shopping, Custom):
   BUDGET,,,,,,,,,,<Category>,TOTAL,<Amount in Rupees>,ALL,,,,,,,,,,,,,,
4. Followed by ACTIVITY rows in chronological order (types: TRAVEL, STAY, EXPLORATION, CUSTOM; status: PLANNED):
   ACTIVITY,,,,,,,,,,,,,,<day_num>,<YYYY-MM-DD>,<TYPE>,<Title>,<HH:MM>,<HH:MM>,<Origin>,<Destination>,<Location>,<Via points separated by semicolons>,,,PLANNED,<Notes>

Output ONLY the raw CSV text without markdown code blocks, commentary, or extra text, ready to be saved directly as a .csv file.`;

export default function NewTripPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [tripName, setTripName] = useState("");
  const [authMemberName, setAuthMemberName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showPromptDetails, setShowPromptDetails] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      // Fallback if clipboard API is restricted
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    }
  }

  async function chooseFile(file: File) {
    setFileName(file.name);
    setTripName("");
    setError("");
    const nextPreview = parseTripCsv(await file.text());
    setPreview(nextPreview);
    const creatorName = nextPreview.trip?.creator_name?.trim().toLowerCase();
    const matched = creatorName ? nextPreview.members.find((member) => member.member_name.trim().toLowerCase() === creatorName) : undefined;
    setAuthMemberName(matched?.member_name || "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview?.trip) { setError("Choose a valid CSV first."); return; }
    const errors = preview.issues.filter((issue) => issue.severity === "error");
    if (errors.length) { setError("Fix the CSV errors before importing."); return; }
    setPending(true); setError("");
    const payload = {
      idempotencyKey: crypto.randomUUID(),
      trip: { name: tripName.trim(), startDate: preview.trip.start_date, endDate: preview.trip.end_date, timezone: preview.trip.timezone || "Asia/Kolkata", currency: preview.trip.currency || "INR" },
      members: preview.members.map((member) => ({ name: member.member_name, email: member.member_email || undefined })),
      authMemberName,
      activities: preview.activities.map((activity) => ({ type: activity.activity_type as "TRAVEL" | "STAY" | "EXPLORATION" | "CUSTOM", title: activity.title, date: activity.date, startTime: activity.start_time || undefined, endTime: activity.end_time || undefined, origin: activity.origin || undefined, destination: activity.destination || undefined, location: activity.location || undefined, viaPoints: activity.via_points || undefined, mapsUrl: activity.maps_url || undefined, distanceKmMilli: activity.distance_km ? Math.round(Number(activity.distance_km) * 1000) : undefined, bikeId: activity.bike_id || undefined, status: (activity.status || "planned") as "planned" | "done" | "skipped" })),
      budgets: preview.budgets.map((budget) => ({ category: budget.category, ruleType: budget.budget_type as "PER_DAY" | "PER_NIGHT" | "TOTAL" | "DERIVED", amountPaise: Math.round(Number(budget.planned_amount) * 100), effectiveFrom: /^\d{4}-\d{2}-\d{2}$/.test(budget.applicable_to) ? budget.applicable_to : preview.trip!.start_date })),
    };
    const response = await fetch("/api/trips/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json() as { tripId?: string; error?: string };
    setPending(false);
    if (!response.ok) { setError(body.error || "Import failed. Nothing was saved."); return; }
    router.push("/?trip=" + body.tripId);
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-card import-trip-card">
        <Link className="import-back-link" href="/">
          <ArrowLeft size={15}/> Back to all trips
        </Link>
        <Image src="/logo.png" alt="Routivity" width={190} height={68} priority/>
        <span className="section-label">CREATE FROM CSV</span>
        <h1>Bring the whole trip in.</h1>
        <p>One file creates the trip, members, days, and itinerary together. Nothing is saved until you confirm the preview.</p>

        <div className="ai-prompt-box">
          <div className="ai-prompt-header">
            <span className="ai-prompt-title">
              <Sparkles size={16}/> Generate CSV with AI
            </span>
            <button
              type="button"
              className={`ai-prompt-copy-btn ${copiedPrompt ? "copied" : ""}`}
              onClick={copyPrompt}
              aria-label="Copy AI prompt template"
            >
              {copiedPrompt ? <Check size={14}/> : <Copy size={14}/>}
              {copiedPrompt ? "Copied!" : "Copy AI Prompt"}
            </button>
          </div>
          <p className="ai-prompt-desc">
            Paste this prompt into ChatGPT, Claude, or Gemini to turn your trip idea into the exact Routivity CSV format.
          </p>
          <ol className="ai-steps">
            <li>Click <strong>Copy AI Prompt</strong> and paste into your AI.</li>
            <li>Replace the placeholders with your route, dates, and riders.</li>
            <li>Save the AI&apos;s answer as a <code>.csv</code> file and upload it below.</li>
          </ol>
          <button
            type="button"
            className="ai-prompt-toggle"
            onClick={() => setShowPromptDetails((prev) => !prev)}
          >
            {showPromptDetails ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            {showPromptDetails ? "Hide prompt template" : "View prompt template"}
          </button>
          {showPromptDetails && (
            <pre className="ai-prompt-preview">{AI_PROMPT_TEMPLATE}</pre>
          )}
        </div>

        <label className="trip-name-field">
          Trip name
          <input value={tripName} onChange={(event) => setTripName(event.target.value)} placeholder="e.g. Konkan Coast Ride" required />
          <small>This name is used for the shared trip, regardless of the CSV title.</small>
        </label>

        <label className="csv-picker">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void chooseFile(file);
            }}
          />
          <b>{fileName || "Choose your itinerary CSV"}</b>
          <small>Use the Routivity template, AI-generated CSV, or matching CSV file.</small>
        </label>

        {preview && (
          <div className="csv-summary">
            <strong>{tripName || preview.trip?.trip_name || "Untitled trip"}</strong>
            <span>{preview.members.length} members · {preview.activities.length} activities</span>
            <label className="member-link-field">
              Which CSV member is you?
              <select value={authMemberName} onChange={(event) => setAuthMemberName(event.target.value)}>
                {preview.members.map((member) => (
                  <option key={member.member_id || member.member_name} value={member.member_name}>
                    {member.member_name}
                  </option>
                ))}
              </select>
              <small>This member will be linked to your signed-in account and become the trip owner.</small>
            </label>
            {preview.issues.slice(0, 6).map((issue, index) => (
              <small className={issue.severity === "error" ? "csv-error" : "csv-warning"} key={index}>
                Row {issue.row}, {issue.column}: {issue.message}
              </small>
            ))}
          </div>
        )}

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={submit}>
          <button className="auth-submit" disabled={pending || !preview || !authMemberName || !tripName.trim()}>
            {pending ? "Saving trip…" : "Create trip from CSV"}
          </button>
        </form>

        <div className="import-trip-footer">
          <a className="auth-switch" href="/templates/routivity-sample.csv" download>
            <Download size={14}/> Download sample template
          </a>
        </div>
      </div>
    </main>
  );
}
