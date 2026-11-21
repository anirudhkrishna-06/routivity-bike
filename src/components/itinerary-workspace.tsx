"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Download, FileSpreadsheet, MapPin, Upload, X } from "lucide-react";
import { exportItinerary, normalizeActivity, parseTripCsv, type CsvRow, type ImportPreview } from "@/lib/csv";
import { queueMutation } from "@/lib/local-queue";
import { flushPendingMutations } from "@/lib/queue-sync";

type Activity = CsvRow & { localId: string };

export function ItineraryWorkspace({ tripId }: { tripId: string }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [message, setMessage] = useState("");

  const days = useMemo(() => Array.from(new Set(activities.map((a) => Number(a.day_number) || 1))).sort((a, b) => a - b), [activities]);
  const dayActivities = activities.filter((activity) => Number(activity.day_number) === selectedDay);

  useEffect(() => {
    void flushPendingMutations();
    const onOnline = () => { void flushPendingMutations(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  async function readFile(file: File) {
    const result = parseTripCsv(await file.text());
    setPreview(result);
    setMessage(result.issues.some((issue) => issue.severity === "error") ? "Fix the highlighted errors before importing." : "Preview is ready to import.");
  }

  function loadPreview() {
    if (!preview || preview.issues.some((issue) => issue.severity === "error")) return;
    const next: Activity[] = preview.activities.map((row, index) => ({ ...row, ...normalizeActivity(row), maps_url: normalizeActivity(row).maps_url ?? "", localId: row.activity_id || `activity-${Date.now()}-${index}` }));
    setActivities(next);
    setSelectedDay(Number(next[0]?.day_number) || 1);
    setMessage(`${next.length} activities ready. Changes save locally first.`);
    const payload = { idempotencyKey: crypto.randomUUID(), trip: { name: preview.trip?.trip_name || "Untitled trip", startDate: preview.trip?.start_date || next[0]?.date || new Date().toISOString().slice(0, 10), endDate: preview.trip?.end_date || next.at(-1)?.date || new Date().toISOString().slice(0, 10), timezone: preview.trip?.timezone || "Asia/Kolkata", currency: preview.trip?.currency || "INR" }, members: preview.members.map((member) => ({ name: member.member_name, email: member.member_email })), activities: next.map((activity) => ({ type: activity.activity_type as "TRAVEL" | "STAY" | "EXPLORATION" | "CUSTOM", title: activity.title, date: activity.date, startTime: activity.start_time, endTime: activity.end_time, origin: activity.origin, destination: activity.destination, location: activity.location, viaPoints: activity.via_points, mapsUrl: activity.maps_url, status: (activity.status || "planned") as "planned" | "done" | "skipped" })) };
    void queueMutation({ id: payload.idempotencyKey, tripId, type: "import-itinerary", payload, createdAt: Date.now() });
    void flushPendingMutations();
  }

  function downloadTemplate() { const link = document.createElement("a"); link.href = "/templates/routivity-sample.csv"; link.download = "routivity-sample.csv"; link.click(); }

  function exportCurrent() {
    const rows = activities.map((activity) => ({ record_type: "ACTIVITY", ...Object.fromEntries(Object.entries(activity).filter(([key]) => key !== "localId")) } as CsvRow));
    const blob = new Blob([exportItinerary(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "routivity-itinerary.csv"; link.click(); URL.revokeObjectURL(url);
  }

  function move(index: number, direction: -1 | 1) {
    const day = [...dayActivities]; const target = index + direction;
    if (target < 0 || target >= day.length) return;
    [day[index], day[target]] = [day[target], day[index]];
    setActivities((current) => current.map((activity) => day.findIndex((candidate) => candidate.localId === activity.localId) >= 0 ? { ...activity, sort_order: String(day.findIndex((candidate) => candidate.localId === activity.localId)) } : activity).sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)));
  }

  function setStatus(localId: string, status: string) { setActivities((current) => current.map((activity) => activity.localId === localId ? { ...activity, status } : activity)); }

  return <section className="itinerary-workspace rise-in">
    <div className="itinerary-heading"><div><span className="section-label">TRIP BUILDER</span><h2>Shape the journey</h2><p>Import once, then keep the whole route moving.</p></div><div className="itinerary-actions"><button className="small-button" onClick={downloadTemplate}><Download size={15}/> Template</button>{activities.length > 0 && <button className="small-button primary-small" onClick={exportCurrent}><Download size={15}/> Export</button>}</div></div>
    <label className="upload-card"><input type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); }}/><div className="upload-icon"><Upload size={21}/></div><strong>Drop your trip CSV here</strong><span>or tap to browse · Google Maps links are generated safely</span></label>
    {message && <div className="import-message"><Check size={15}/>{message}</div>}
    {preview && <div className="preview-panel"><div className="preview-top"><div><span className="section-label">IMPORT PREVIEW</span><h3>{preview.trip?.trip_name || "Untitled trip"}</h3><p>{preview.members.length} members · {preview.activities.length} activities · {preview.issues.length} notes</p></div><button className="icon-button" onClick={() => setPreview(null)}><X size={17}/></button></div>{preview.issues.length > 0 && <div className="issue-list">{preview.issues.slice(0, 5).map((issue, index) => <div className={issue.severity === "error" ? "issue error" : "issue"} key={index}><AlertTriangle size={14}/><span><b>Row {issue.row}, {issue.column}</b> — {issue.message}</span></div>)}</div>}<button className="import-button" disabled={preview.issues.some((issue) => issue.severity === "error")} onClick={loadPreview}><FileSpreadsheet size={17}/> Import this preview</button></div>}
    {activities.length > 0 && <div className="itinerary-list"><div className="day-tabs">{days.map((day) => <button className={selectedDay === day ? "day-tab active" : "day-tab"} key={day} onClick={() => setSelectedDay(day)}><span>DAY {day}</span><b>{activities.find((a) => Number(a.day_number) === day)?.date}</b></button>)}</div>{dayActivities.map((activity, index) => <article className="activity-item" key={activity.localId}><div className="activity-time">{activity.start_time || "—"}<i/></div><div className="activity-detail"><div className="activity-type">{activity.activity_type}</div><h3>{activity.title}</h3><p>{activity.origin && activity.destination ? `${activity.origin} → ${activity.destination}` : activity.location || activity.notes || "No location added"}</p>{activity.maps_url && <a href={activity.maps_url} target="_blank" rel="noopener noreferrer"><MapPin size={13}/> Open in Maps</a>}<div className="activity-controls"><button onClick={() => setStatus(activity.localId, activity.status === "done" ? "planned" : "done")} className={activity.status === "done" ? "state done" : "state"}><Check size={12}/> {activity.status}</button><button onClick={() => move(index, -1)} aria-label="Move up"><ArrowUp size={14}/></button><button onClick={() => move(index, 1)} aria-label="Move down"><ArrowDown size={14}/></button></div></div></article>)}</div>}
  </section>;
}
