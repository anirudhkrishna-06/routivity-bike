"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileUp,
  Sparkles,
} from "lucide-react";
import { parseTripCsv, type ImportPreview } from "@/lib/csv";
import { AI_PROMPT_TEMPLATE } from "@/lib/ai-prompt";

export default function NewTripPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<ImportPreview>();
  const [fileName, setFileName] = useState("");
  const [tripName, setTripName] = useState("");
  const [authMemberName, setAuthMemberName] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function copyPrompt() {
    await navigator.clipboard?.writeText(AI_PROMPT_TEMPLATE);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  async function chooseFile(file: File) {
    setFileName(file.name);
    setError("");
    const next = parseTripCsv(await file.text());
    setPreview(next);
    setTripName(next.trip?.trip_name || "");
    const creator = next.trip?.creator_name?.toLowerCase();
    const match = next.members.find(
      (member) => member.member_name.toLowerCase() === creator,
    );
    setAuthMemberName(match?.member_name || next.members[0]?.member_name || "");
    setStep(3);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!preview?.trip) return;
    const blocking = preview.issues.filter(
      (issue) => issue.severity === "error",
    );
    if (blocking.length) {
      setError("Fix the blocking CSV issues before creating the trip.");
      return;
    }
    setPending(true);
    setError("");
    const response = await fetch("/api/trips/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        trip: {
          name: tripName.trim(),
          startDate: preview.trip.start_date,
          endDate: preview.trip.end_date,
          timezone: preview.trip.timezone || "Asia/Kolkata",
          currency: preview.trip.currency || "INR",
        },
        members: preview.members.map((member) => ({
          name: member.member_name,
          email: member.member_email || undefined,
        })),
        authMemberName,
        days: preview.days.map((day) => ({
          date: day.date,
          location: day.location || undefined,
        })),
        activities: preview.activities.map((activity) => ({
          type: activity.activity_type,
          title: activity.title,
          date: activity.date,
          startTime: activity.start_time || undefined,
          endTime: activity.end_time || undefined,
          origin: activity.origin || undefined,
          destination: activity.destination || undefined,
          location: activity.location || undefined,
          notes: activity.notes || undefined,
          commitment: activity.commitment || "PLANNED",
          timeWindow: activity.time_window || undefined,
          durationMin: activity.duration_min
            ? Number(activity.duration_min)
            : undefined,
          travelMode: activity.travel_mode || undefined,
          distanceKmMilli: activity.distance_km
            ? Math.round(Number(activity.distance_km) * 1000)
            : undefined,
          stayNights: activity.nights ? Number(activity.nights) : undefined,
          status: "planned",
        })),
        budgets: preview.budgets.map((budget) => ({
          category: budget.category,
          ruleType: budget.budget_type,
          amountPaise: Math.round(Number(budget.planned_amount) * 100),
          effectiveFrom: /^\d{4}-\d{2}-\d{2}$/.test(budget.applicable_to)
            ? budget.applicable_to
            : preview.trip!.start_date,
        })),
      }),
    });
    const body = (await response.json()) as { tripId?: string; error?: string };
    setPending(false);
    if (!response.ok) {
      setError(body.error || "Import failed. Nothing was saved.");
      return;
    }
    setStep(4);
    window.setTimeout(() => router.push("/?trip=" + body.tripId), 700);
  }
  const issues = preview?.issues || [];
  return (
    <main className="auth-page">
      <div className="auth-card import-trip-card trip-create-new">
        <Link className="import-back-link" href="/">
          <ChevronLeft size={15} /> Back to all trips
        </Link>
        <Image
          src="/logo.png"
          alt="Routivity"
          width={190}
          height={68}
          priority
        />
        <span className="section-label">CREATE A TRIP</span>
        <h1>Plan, adjust, and resolve.</h1>
        <p>
          Describe your trip to an AI assistant, upload the file it gives you,
          and we’ll build your itinerary.
        </p>
        <div className="create-stepper">
          {["Plan with AI", "Upload", "Review"].map((label, index) => (
            <div
              className={
                step === index + 1 ? "active" : step > index + 1 ? "done" : ""
              }
              key={label}
            >
              <span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>
              <b>{label}</b>
            </div>
          ))}
        </div>
        {step === 1 && (
          <section className="create-stage">
            <div className="how-card">
              <span className="section-label">HOW IT WORKS</span>
              <ol>
                <li>Copy the prompt</li>
                <li>Answer the AI’s questions</li>
                <li>Upload the CSV it gives you</li>
              </ol>
              <p>You can change everything in Routivity after importing.</p>
            </div>
            <div className="ai-prompt-box">
              <div className="ai-prompt-header">
                <span className="ai-prompt-title">
                  <Sparkles size={16} /> Plan with ChatGPT or Claude
                </span>
                <button
                  className="ai-prompt-copy-btn"
                  onClick={() => void copyPrompt}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                  {copied ? "Copied" : "Copy prompt"}
                </button>
              </div>
              <p className="ai-prompt-desc">
                The assistant interviews you first, asks about stays and
                sightseeing, and labels uncertain plans as tentative.
              </p>
              <pre className="ai-prompt-preview">{AI_PROMPT_TEMPLATE}</pre>
              <div className="create-links">
                <a href="/templates/routivity-sample.csv" download>
                  <Download size={14} /> Download CSV template
                </a>
                <a href="/routivity-trip.csv" download>
                  <Download size={14} /> See an example trip
                </a>
              </div>
            </div>
            <button className="auth-submit" onClick={() => setStep(2)}>
              I have my CSV <ChevronRight size={16} />
            </button>
          </section>
        )}
        {step === 2 && (
          <section className="create-stage">
            <label className="csv-dropzone">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void chooseFile(file);
                }}
              />
              <FileUp size={28} />
              <b>Drop your CSV here</b>
              <small>or tap to choose a .csv file</small>
            </label>
            <button className="text-button" onClick={() => setStep(1)}>
              <ChevronLeft size={14} /> Back to plan
            </button>
          </section>
        )}
        {step === 3 && preview && (
          <section className="create-stage review-stage">
            <div className="review-summary">
              <span>
                <b>{preview.days.length || "—"}</b> days
              </span>
              <span>
                <b>{preview.activities.length}</b> activities
              </span>
              <span>
                <b>{preview.members.length}</b> riders
              </span>
              <span>
                <b>{preview.budgets.length}</b> budgets
              </span>
            </div>
            <div className="review-file">
              <FileUp size={16} /> {fileName}
              <button className="text-button" onClick={() => setStep(2)}>
                Replace
              </button>
            </div>
            <div className="review-preview">
              <span className="section-label">ITINERARY PREVIEW</span>
              {Array.from(
                new Set(
                  preview.activities.map(
                    (item) => `${item.day_number}|${item.date}`,
                  ),
                ),
              ).map((key) => {
                const [number, date] = key.split("|");
                const items = preview.activities.filter(
                  (item) => item.day_number === number,
                );
                return (
                  <div key={key}>
                    <b>
                      Day {number} · {dateLabel(date)}
                    </b>
                    <small>{items.map((item) => item.title).join(" · ")}</small>
                  </div>
                );
              })}
            </div>
            <div className="review-issues">
              <span className="section-label">CHECKS · {issues.length}</span>
              {issues.length ? (
                issues.map((issue, index) => (
                  <p
                    className={
                      issue.severity === "error" ? "csv-error" : "csv-warning"
                    }
                    key={index}
                  >
                    Row {issue.row}, {issue.column}: {issue.message}
                  </p>
                ))
              ) : (
                <p className="csv-success">
                  <Check size={14} /> Everything looks ready to import.
                </p>
              )}
            </div>
            <label className="trip-name-field">
              Trip name
              <input
                value={tripName}
                onChange={(event) => setTripName(event.target.value)}
                placeholder="e.g. Konkan Coast Ride"
                required
              />
            </label>
            <label className="member-link-field">
              Which rider are you?
              <div className="rider-chips">
                {preview.members.map((member) => (
                  <button
                    type="button"
                    className={
                      authMemberName === member.member_name ? "selected" : ""
                    }
                    key={member.member_name}
                    onClick={() => setAuthMemberName(member.member_name)}
                  >
                    {authMemberName === member.member_name && (
                      <Check size={13} />
                    )}{" "}
                    {member.member_name}
                  </button>
                ))}
              </div>
            </label>
            {error && <div className="auth-error">{error}</div>}
            <form onSubmit={submit}>
              <button
                className="auth-submit"
                disabled={
                  pending ||
                  issues.some((issue) => issue.severity === "error") ||
                  !tripName.trim() ||
                  !authMemberName
                }
              >
                {pending ? "Creating trip…" : "Create trip"}
              </button>
            </form>
          </section>
        )}
        {step === 4 && (
          <section className="create-success">
            <Check size={38} />
            <h2>Trip created</h2>
            <p>Opening your itinerary…</p>
          </section>
        )}
      </div>
    </main>
  );
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}
