"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  conflict,
  dayDestination,
  freeWindows,
  formatDuration,
  hhmm,
  minutes,
  stayBands,
  suggestSlots,
  type ItineraryActivity,
  type ItineraryDay,
} from "@/lib/itinerary/engine";

type Activity = ItineraryActivity & {
  endTime?: string | null;
  mapsUrl?: string | null;
  viaPoints?: string | null;
  notes?: string | null;
  travelMode?: string | null;
  stayNights?: number | null;
  sortOrder: number;
  distanceKmMilli?: number | null;
};
type Panel = "menu" | "event" | "side" | "day" | "delete" | "conflict" | null;
const initialForm = {
  title: "",
  type: "EXPLORATION",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
  origin: "",
  destination: "",
  notes: "",
  commitment: "PLANNED",
  status: "planned",
  travelMode: "Bike",
  distanceKm: "",
  nights: "1",
};
function dateLabel(value: string, long = false) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}
function timeLabel(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(`2026-01-01T${value}:00`))
    : "";
}

type TravelDetails = {
  distanceKm?: number;
  pureRide?: string;
  expectedDuration?: string;
  points: string[];
};

function parseTravelDetails(notes?: string | null): TravelDetails {
  const text = notes?.trim() || "";
  const distance = text.match(/(\d+(?:\.\d+)?)\s*km\b/i)?.[1];
  const pureRide = text.match(/pure ride\s+([^.(]+?)(?=\s*\(|\s*\.|$)/i)?.[1]?.trim();
  const expectedDuration = text.match(/pure ride[^.(]*\(([^)]+)\)/i)?.[1]?.trim();
  const firstStop = text.search(/(?<!\d)\.\s+(?=[A-Z0-9])/);
  const detailText = firstStop >= 0 ? text.slice(firstStop + 1) : "";
  const points = detailText
    .split(/(?<!\d)\.\s+(?=[A-Z0-9])/)
    .map((point) => point.trim().replace(/[.]$/, ""))
    .filter(Boolean);

  return {
    distanceKm: distance ? Number(distance) : undefined,
    pureRide,
    expectedDuration,
    points,
  };
}

function AnimatedDistance({ value, active }: { value: number; active: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!active || !Number.isFinite(value)) {
      setDisplayValue(0);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const duration = 850;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active, value]);

  return <strong>{Math.round(displayValue).toLocaleString("en-IN")} km</strong>;
}

function TravelInsights({ item, active }: { item: Activity; active: boolean }) {
  const parsed = parseTravelDetails(item.notes);
  const distanceKm = parsed.distanceKm ?? (item.distanceKmMilli ? item.distanceKmMilli / 1000 : undefined);
  const points = parsed.points;
  const columns = [points.slice(0, Math.ceil(points.length / 2)), points.slice(Math.ceil(points.length / 2))];

  if (!distanceKm && !parsed.pureRide && !points.length) {
    return item.notes ? <p>{item.notes}</p> : null;
  }

  return (
    <div className="travel-insights">
      {(distanceKm || parsed.pureRide) && (
        <div className="travel-metrics">
          {distanceKm !== undefined && (
            <div className="travel-metric">
              <span>Distance</span>
              <AnimatedDistance value={distanceKm} active={active} />
            </div>
          )}
          {parsed.pureRide && (
            <div className="travel-metric">
              <span>Expected duration</span>
              <strong>{parsed.pureRide}</strong>
              {parsed.expectedDuration && <small>{parsed.expectedDuration}</small>}
            </div>
          )}
        </div>
      )}
      {points.length > 0 && (
        <div className="travel-points">
          {columns.map((column, columnIndex) => (
            <ul key={columnIndex}>
              {column.map((point) => <li key={point}>{point}</li>)}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}

export function ItineraryWorkspace({ tripId }: { tripId: string }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [expanded, setExpanded] = useState<string>();
  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState<Activity>();
  const [form, setForm] = useState({ ...initialForm });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Loading your itinerary…");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [sideTitle, setSideTitle] = useState("");
  const [sideDuration, setSideDuration] = useState("60");
  const [sidePreference, setSidePreference] = useState("ANYTIME");
  const [sideStep, setSideStep] = useState(1);
  const [sideChoice, setSideChoice] = useState<{
    start: number;
    end: number;
  }>();
  const [addAfter, setAddAfter] = useState(1);
  const [addLocation, setAddLocation] = useState("");
  const [extendStay, setExtendStay] = useState(true);
  const [dayProposal, setDayProposal] = useState<{ id: string; diff: { added: { dayNumber: number; date?: string }; shiftedDays?: number; budgetImpact?: string; locationHint?: string | null } }>();
  const [deleteTarget, setDeleteTarget] = useState<Activity>();
  const [conflictTarget, setConflictTarget] = useState<ItineraryActivity>();
  const [toast, setToast] = useState<{ message: string; undo: () => void }>();
  const cacheKey = `routivity-itinerary-${tripId}`;
  const day = days.find((item) => item.dayNumber === selectedDay) || days[0];
  const items = useMemo(
    () =>
      activities
        .filter((item) => item.dayNumber === selectedDay)
        .sort(
          (a, b) =>
            (minutes(a.startTime) ?? 9999) - (minutes(b.startTime) ?? 9999) ||
            a.sortOrder - b.sortOrder,
        ),
    [activities, selectedDay],
  );
  const destination = day
    ? dayDestination(
        day,
        activities,
        days.find((item) => item.dayNumber === selectedDay - 1)?.location ?? undefined,
      )
    : "";
  const windows = useMemo(() => freeWindows(items), [items]);
  const suggestions = useMemo(
    () => suggestSlots(items, Number(sideDuration) || 60, sidePreference),
    [items, sideDuration, sidePreference],
  );
  const stays = useMemo(() => stayBands(days, activities), [days, activities]);
  const affectedStay = stays.find((stay) => addAfter >= stay.checkInDay && addAfter < stay.checkOutDay);
  function showToast(message: string, undo: () => void) { setToast({ message, undo }); window.setTimeout(() => setToast(undefined), 8000); }
  async function load() {
    try {
      const response = await fetch(`/api/trips/${tripId}/activities`, {
        cache: "no-store",
      });
      const body = (await response.json()) as {
        activities?: Activity[];
        days?: ItineraryDay[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "Couldn't load your itinerary.");
      setActivities(body.activities || []);
      setDays(body.days || []);
      const today = new Date().toISOString().slice(0, 10);
      setSelectedDay(
        (body.days || []).find((item) => item.date === today)?.dayNumber ||
          body.days?.[0]?.dayNumber ||
          1,
      );
      setMessage("Your itinerary is saved and shared with the trip.");
      window.localStorage.setItem(
        cacheKey,
        JSON.stringify({
          activities: body.activities || [],
          days: body.days || [],
        }),
      );
    } catch (caught) {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const value = JSON.parse(cached) as {
            activities: Activity[];
            days: ItineraryDay[];
          };
          setActivities(value.activities);
          setDays(value.days);
          setMessage("Viewing saved itinerary (offline). Reconnect to edit.");
          return;
        } catch {}
      }
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Couldn't load your itinerary.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const update = () => setOnline(navigator.onLine); update(); window.addEventListener("online", update); window.addEventListener("offline", update); return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); }; }, []);
  function openEvent(item?: Activity, start?: number, end?: number) {
    if (!online) return;
    if (item) {
      setEditing(item);
      setForm({
        ...initialForm,
        title: item.title,
        type: item.type === "CUSTOM" ? "BREAK" : item.type,
        date: item.date,
        startTime: item.startTime || "",
        endTime: item.endTime || "",
        location: item.location || "",
        origin: item.origin || "",
        destination: item.destination || "",
        notes: item.notes || "",
        commitment: item.commitment || "PLANNED",
        status: item.status || "planned",
        travelMode: item.travelMode || "Bike",
        distanceKm: item.distanceKmMilli
          ? String(item.distanceKmMilli / 1000)
          : "",
        nights: String(item.stayNights || 1),
      });
    } else {
      const from =
        start ??
        windows.at(-1)?.start ??
        (minutes(items.at(-1)?.endTime) || 0) + 15;
      setEditing(undefined);
      setForm({
        ...initialForm,
        date: day?.date || "",
        startTime: hhmm(from),
        endTime: hhmm(end ?? from + 60),
        location: "",
      });
    }
    setError("");
    setPanel("event");
  }
  function update(key: string, value: string) {
    setForm((old) => ({ ...old, [key]: value }));
  }
  async function saveEvent() {
    if (!form.title || !form.date) return;
    const dayNumber =
      days.find((item) => item.date === form.date)?.dayNumber || selectedDay;
    const clash = conflict(
      activities.filter((item) => item.dayNumber === dayNumber),
      form.startTime,
      form.endTime,
      editing?.id,
    );
    if (clash) {
      setConflictTarget(clash); setPanel("conflict"); setError(""); return;
      if (clash) {
      setError(
        // @ts-expect-error narrowed by the surrounding legacy branch
        `Overlaps ${clash.title} (${timeLabel(clash.startTime)}–${timeLabel(clash.endTime)}). Choose another time.`,
      );
      return; }
    }
    setBusy(true);
    setError("");
    const activity = {
      type: (form.type === "BREAK" ? "CUSTOM" : form.type) as
        "TRAVEL" | "STAY" | "EXPLORATION" | "CUSTOM",
      title: form.title,
      date: form.date,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      location: form.location || undefined,
      origin: form.origin || undefined,
      destination: form.destination || undefined,
      notes: form.notes || undefined,
      commitment: form.commitment as
        "PLANNED" | "OPTIONAL" | "TENTATIVE" | "CONFIRMED",
      travelMode: form.travelMode,
      distanceKmMilli: form.distanceKm
        ? Math.round(Number(form.distanceKm) * 1000)
        : undefined,
      stayNights: form.type === "STAY" ? Number(form.nights) || 1 : undefined,
      status: form.status as "planned" | "done" | "skipped",
    };
    const previous = editing;
    const response = await fetch(`/api/trips/${tripId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: editing ? "update" : "create",
        payload: editing
          ? {
              activityId: editing.id,
              idempotencyKey: crypto.randomUUID(),
              change: activity,
            }
          : { idempotencyKey: crypto.randomUUID(), activity },
      }),
    });
    const body = (await response.json()) as { error?: string; id?: string };
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Couldn't save. Your entry is kept.");
      return;
    }
    setPanel(null);
    const undoId = previous?.id || body.id;
    if (undoId) showToast(previous ? "Event saved" : "Event added", () => { void fetch(`/api/trips/${tripId}/activities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: previous ? "update" : "delete", payload: previous ? { activityId: undoId, idempotencyKey: crypto.randomUUID(), change: previous } : { activityId: undoId, idempotencyKey: crypto.randomUUID() } }) }).then(load); });
    await load();
  }
  async function itemAction(operation: "duplicate" | "delete", item: Activity) {
    if (!online) return;
    if (operation === "delete" && !window.confirm(`Remove “${item.title}”?`))
      return;
    setBusy(true);
    const response = await fetch(`/api/trips/${tripId}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation,
        payload: { activityId: item.id, idempotencyKey: crypto.randomUUID() },
      }),
    });
    const body = (await response.json()) as { error?: string; id?: string; activityId?: string };
    setBusy(false);
    if (!response.ok) {
      if (operation === "delete" && body.error?.startsWith("EXPENSE_LINKED")) { setDeleteTarget(item); setPanel("delete"); }
      else setError(body.error || "Unable to update event.");
    }
    else {
      setExpanded(undefined);
      const changedId = body.id || body.activityId || item.id;
      if (operation === "duplicate") showToast("Event duplicated", () => { void fetch(`/api/trips/${tripId}/activities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "delete", payload: { activityId: changedId, idempotencyKey: crypto.randomUUID() } }) }).then(load); });
      if (operation === "delete") showToast("Event deleted", () => { void fetch(`/api/trips/${tripId}/activities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "restore", payload: { activityId: item.id, idempotencyKey: crypto.randomUUID() } }) }).then(load); });
      await load();
    }
  }
  function chooseConflict(option: "shorten" | "shift" | "another") {
    if (!conflictTarget) return;
    const start = minutes(form.startTime) ?? 360; const end = minutes(form.endTime) ?? start + 60; const conflictStart = minutes(conflictTarget.startTime) ?? end; const conflictEnd = minutes(conflictTarget.endTime) ?? conflictStart + 60;
    if (option === "shorten" && conflictStart - start >= 30) setForm((old) => ({ ...old, endTime: hhmm(conflictStart - 15) }));
    if (option === "shift") { const nextStart = conflictEnd + 15; setForm((old) => ({ ...old, startTime: hhmm(nextStart), endTime: hhmm(nextStart + (end - start)) })); }
    if (option === "another") { const next = days.find((item) => item.date > form.date); if (next) setForm((old) => ({ ...old, date: next.date })); }
    setConflictTarget(undefined); setPanel("event");
  }
  async function resolveDelete(mode: "unlink" | "reassign", targetActivityId?: string) {
    if (!online) return;
    if (!deleteTarget || (mode === "reassign" && !targetActivityId)) return;
    setBusy(true);
    const response = await fetch(`/api/trips/${tripId}/activities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "delete", payload: { activityId: deleteTarget.id, idempotencyKey: crypto.randomUUID(), resolution: { mode, targetActivityId } } }) });
    const body = (await response.json()) as { error?: string }; setBusy(false);
    if (!response.ok) { setError(body.error || "Unable to remove event."); return; }
    setDeleteTarget(undefined); setPanel(null); await load();
  }
  async function addDay() {
    if (!online) return;
    setBusy(true);
    if (dayProposal) {
      const apply = await fetch(`/api/trips/${tripId}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "apply", proposalId: dayProposal.id }) });
      setBusy(false);
      if (!apply.ok) { setError(((await apply.json()) as { error?: string }).error || "Unable to add the day."); return; }
      const newDay = dayProposal.diff.added.dayNumber;
      if (extendStay && affectedStay) { await fetch(`/api/trips/${tripId}/activities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "update", payload: { activityId: affectedStay.activityId, idempotencyKey: crypto.randomUUID(), change: { stayNights: affectedStay.nights + 1 } } }) }); }
      const appliedProposalId = dayProposal.id; showToast("Day added", () => { void fetch(`/api/trips/${tripId}/schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "undo", proposalId: appliedProposalId }) }).then(load); }); setDayProposal(undefined); setPanel(null); await load(); setSelectedDay(newDay); return;
    }
    const response = await fetch(`/api/trips/${tripId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "propose-add-day",
        afterDayNumber: addAfter,
        locationHint: addLocation,
      }),
    });
    const body = (await response.json()) as {
      proposal?: { id: string; diff: { added: { dayNumber: number; date?: string }; shiftedDays?: number; budgetImpact?: string; locationHint?: string | null } };
      error?: string;
    };
    if (!response.ok || !body.proposal) {
      setError(body.error || "Unable to prepare a day.");
      setBusy(false);
      return;
    }
    setBusy(false);
    setDayProposal(body.proposal);
  }
  return (
    <section className="new-itinerary rise-in">
      <div className="itinerary-top">
        <div>
          <h1>Your journey</h1>
          <p>{message}</p>
        </div>
        
      </div>
      
      {!online && <div className="itinerary-error">Viewing saved itinerary. Reconnect to edit.</div>}
      <div className="day-rail" role="tablist">
        {days.map((item) => {
          const count = activities.filter(
            (activity) => activity.dayNumber === item.dayNumber,
          ).length;
          const place = dayDestination(item, activities);
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={selectedDay === item.dayNumber}
              className={`day-chip ${selectedDay === item.dayNumber ? "selected" : ""} ${count ? "" : "empty"}`}
              onClick={() => setSelectedDay(item.dayNumber)}
            >
              <small>{dateLabel(item.date)}</small>
              <b>{place || "Free day"}</b>
              <span>
                {count} {count === 1 ? "item" : "items"}
              </span>
            </button>
          );
        })}
        <button
          className="day-chip add-day-chip"
          onClick={() => {
            setAddAfter(selectedDay);
            setAddLocation(destination);
            setPanel("day");
          }}
        >
          <CalendarPlus size={12} />
          <b>Add day</b>
        </button>
      </div>
      {day && (
        <>
          <div className="day-header">
            <div>
              <span className="section-label">
                {dateLabel(day.date, true)}
              </span>
              <h2>{destination || "Unplanned day"}</h2>
            </div>
            <button className="add-pill" onClick={() => setPanel("menu")}>
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="timeline">
            <div className="timeline-rail" />
            {!items.length && (
              <div className="empty-day">
                <Sparkles size={22} />
                <h3>Nothing planned for {dateLabel(day.date, true)}</h3>
                <p>Add an event or travel, or build a complete day.</p>
                <button
                  className="small-button primary-small"
                  onClick={() => openEvent()}
                >
                  <Plus size={14} /> Add event
                </button>
              </div>
            )}
            {items.map((item) => (
              <article
                className={`timeline-event ${item.type.toLowerCase()} ${expanded === item.id ? "expanded" : ""}`}
                key={item.id}
              >
                <button
                  className="event-card"
                  aria-expanded={expanded === item.id}
                  onClick={() =>
                    setExpanded(expanded === item.id ? undefined : item.id)
                  }
                >
                  <span className="event-time">
                    {timeLabel(item.startTime) || "Anytime"}
                    {item.endTime && ` – ${timeLabel(item.endTime)}`}
                  </span>
                  <span className="event-main">
                    <b>{item.title}</b>
                    <small>
                      {item.origin && item.destination
                        ? `${item.origin} → ${item.destination}`
                        : item.location ||
                          (item.type === "STAY" ? "Overnight stay" : "")}
                    </small>
                  </span>
                  <span
                    className={`commitment ${String(item.commitment || "PLANNED").toLowerCase()}`}
                  >
                    {String(item.commitment || "PLANNED").toLowerCase()}
                  </span>
                </button>
                <div className={`event-details ${expanded === item.id ? "open" : ""}`} aria-hidden={expanded !== item.id}>
                    {item.type === "TRAVEL" ? (
                      <TravelInsights item={item} active={expanded === item.id} />
                    ) : item.notes ? <p>{item.notes}</p> : null}
                    {item.viaPoints && <small>Via {item.viaPoints}</small>}
                    {item.distanceKmMilli && (
                      <small>
                        {item.distanceKmMilli / 1000} km ·{" "}
                        {item.travelMode || "Travel"}
                      </small>
                    )}
                    {item.mapsUrl && (
                      <a href={item.mapsUrl} target="_blank" rel="noreferrer">
                        <MapPin size={13} /> Open in Maps{" "}
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <div className="event-actions">
                      <button onClick={() => openEvent(item)}>
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        onClick={() => void itemAction("duplicate", item)}
                      >
                        <Copy size={13} /> Duplicate
                      </button>
                      <button
                        onClick={() => void itemAction("delete", item)}
                        disabled={busy}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {error && <div className="itinerary-error">{error}</div>}
      {toast && <div className="undo-toast" role="status"><span>{toast.message}</span><button onClick={() => { toast.undo(); setToast(undefined); }}>Undo</button></div>}
      {panel && (
        <div
          className="itinerary-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPanel(null);
          }}
        >
          <div className="itinerary-sheet" role="dialog" aria-modal="true">
            <button
              className="sheet-close"
              onClick={() => setPanel(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>
            {panel === "menu" && (
              <>
                <span className="section-label">
                  ADDING TO DAY {selectedDay}
                </span>
                <h2>What are you adding?</h2>
                <div className="add-options">
                  {[
                    ["Event", "A sight, activity or break", () => openEvent()],
                    [
                      "Travel",
                      "Ride or transfer",
                      () => {
                        setForm({
                          ...initialForm,
                          type: "TRAVEL",
                          date: day?.date || "",
                          startTime: "",
                          endTime: "",
                        });
                        setPanel("event");
                      },
                    ],
                    [
                      "Stay",
                      "Hotel, homestay or camp",
                      () => {
                        setForm({
                          ...initialForm,
                          type: "STAY",
                          date: day?.date || "",
                        });
                        setPanel("event");
                      },
                    ],
                    [
                      "Side visit",
                      "We’ll find a time",
                      () => {
                        setSideStep(1);
                        setPanel("side");
                      },
                    ],
                    [
                      "Complete day",
                      "Insert a whole new day",
                      () => setPanel("day"),
                    ] as const,
                  ].map((option) => {
                    const label = String(option[0]);
                    const text = String(option[1]);
                    const action = option[2] as () => void;
                    return (
                    <button key={label} onClick={action}>
                      <b>{label}</b>
                      <small>{text}</small>
                    </button>
                    );
                  })}
                </div>
              </>
            )}
            {panel === "event" && (
              <div className="event-form">
                <span className="section-label">
                  {editing ? "EDIT EVENT" : `ADDING TO DAY ${selectedDay}`}
                </span>
                <h2>{editing ? "Edit event" : "Add an event"}</h2>
                <input
                  autoFocus
                  placeholder="What are you adding?"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                />
                <div className="chip-row">
                  {[
                    ["EXPLORATION", "Event"],
                    ["TRAVEL", "Travel"],
                    ["STAY", "Stay"],
                    ["BREAK", "Break"],
                  ].map(([value, label]) => (
                    <button
                      className={form.type === value ? "active" : ""}
                      key={value}
                      onClick={() => update("type", value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label>
                  Day
                  <select
                    value={form.date}
                    onChange={(e) => update("date", e.target.value)}
                  >
                    {days.map((item) => (
                      <option key={item.id} value={item.date}>
                        Day {item.dayNumber} · {dateLabel(item.date)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-grid">
                  <label>
                    Start
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => update("startTime", e.target.value)}
                    />
                  </label>
                  <label>
                    End
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => update("endTime", e.target.value)}
                    />
                  </label>
                </div>
                <p className="fit-note">
                  {conflict(
                    activities.filter((item) => item.date === form.date),
                    form.startTime,
                    form.endTime,
                    editing?.id,
                  )
                    ? "Overlaps another event · adjust the time"
                    : "Fits · suggestions are editable"}
                </p>
                <label>
                  Location
                  <input
                    placeholder={destination ? `in ${destination}` : "Location"}
                    value={form.location}
                    onChange={(e) => update("location", e.target.value)}
                  />
                </label>
                {form.type === "TRAVEL" && (
                  <div className="form-grid">
                    <label>
                      Origin
                      <input
                        value={form.origin}
                        onChange={(e) => update("origin", e.target.value)}
                      />
                    </label>
                    <label>
                      Destination
                      <input
                        value={form.destination}
                        onChange={(e) => update("destination", e.target.value)}
                      />
                    </label>
                    <label>
                      Mode
                      <select
                        value={form.travelMode}
                        onChange={(e) => update("travelMode", e.target.value)}
                      >
                        {["Bike", "Car", "Train", "Bus", "Flight", "Walk"].map(
                          (mode) => (
                            <option key={mode}>{mode}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      Distance km
                      <input
                        type="number"
                        value={form.distanceKm}
                        onChange={(e) => update("distanceKm", e.target.value)}
                      />
                    </label>
                  </div>
                )}
                {form.type === "STAY" && (
                  <label>
                    Nights
                    <input
                      type="number"
                      min="1"
                      value={form.nights}
                      onChange={(e) => update("nights", e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Commitment
                  <select
                    value={form.commitment}
                    onChange={(e) => update("commitment", e.target.value)}
                  >
                    <option>PLANNED</option>
                    <option>OPTIONAL</option>
                    <option>TENTATIVE</option>
                    <option>CONFIRMED</option>
                  </select>
                </label>
                <label>
                  Note
                  <textarea
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Add a note (optional)"
                  />
                </label>
                {error && <p className="form-error">{error}</p>}
                {dayProposal && <p className="fit-note">Review the proposed before/after change, then apply it.</p>}
                <button
                  className="primary-action"
                  disabled={!form.title || busy}
                  onClick={() => void saveEvent()}
                >
                  {busy
                    ? "Saving…"
                    : editing
                      ? "Save changes"
                      : `Add to Day ${selectedDay}`}
                </button>
              </div>
            )}
            {panel === "side" && (
              <div className="event-form">
                <span className="section-label">
                  SIDE VISIT · STEP {sideStep} OF 3
                </span>
                <h2>
                  {sideStep === 1
                    ? "What would you like to visit?"
                    : sideStep === 2
                      ? "When could it fit?"
                      : "Review suggested visit"}
                </h2>
                {sideStep === 1 && (
                  <>
                    <input
                      autoFocus
                      placeholder="Place or heritage site"
                      value={sideTitle}
                      onChange={(e) => setSideTitle(e.target.value)}
                    />
                    <label>
                      How long
                      <select
                        value={sideDuration}
                        onChange={(e) => setSideDuration(e.target.value)}
                      >
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="90">1.5 hours</option>
                        <option value="120">2 hours</option>
                      </select>
                    </label>
                    <label>
                      Preferred time
                      <select
                        value={sidePreference}
                        onChange={(e) => setSidePreference(e.target.value)}
                      >
                        <option>ANYTIME</option>
                        <option>MORNING</option>
                        <option>AFTERNOON</option>
                        <option>EVENING</option>
                      </select>
                    </label>
                    <button
                      className="primary-action"
                      disabled={!sideTitle}
                      onClick={() => setSideStep(2)}
                    >
                      Find a time
                    </button>
                  </>
                )}
                {sideStep === 2 && (
                  <div className="suggestions">
                    {suggestions.length ? (
                      suggestions.map((suggestion) => (
                        <button
                          key={suggestion.start}
                          onClick={() => {
                            setSideChoice(suggestion);
                            setSideStep(3);
                          }}
                        >
                          <b>
                            {timeLabel(hhmm(suggestion.start))}–
                            {timeLabel(hhmm(suggestion.end))} · Fits as is
                          </b>
                          <small>{suggestion.reasons[0]}</small>
                        </button>
                      ))
                    ) : (
                      <p>
                        No room today for {formatDuration(Number(sideDuration))}
                        . Try a shorter visit or another day.
                      </p>
                    )}
                    <button
                      className="text-button"
                      onClick={() => setSideStep(1)}
                    >
                      Back
                    </button>
                  </div>
                )}
                {sideStep === 3 && sideChoice && (
                  <>
                    <div className="chosen-preview">
                      <Check size={15} /> {sideTitle} ·{" "}
                      {timeLabel(hhmm(sideChoice.start))}–
                      {timeLabel(hhmm(sideChoice.end))}
                    </div>
                    <p>Fits without moving anything.</p>
                    <button
                      className="primary-action"
                      onClick={() => {
                        setForm({
                          ...initialForm,
                          title: sideTitle,
                          date: day?.date || "",
                          startTime: hhmm(sideChoice.start),
                          endTime: hhmm(sideChoice.end),
                          location: destination,
                        });
                        setPanel("event");
                      }}
                    >
                      Add visit
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setSideStep(2)}
                    >
                      Back
                    </button>
                  </>
                )}
              </div>
            )}
            {panel === "conflict" && conflictTarget && (
              <div className="event-form">
                <span className="section-label">SCHEDULE CONFLICT</span>
                <h2>This overlaps {conflictTarget.title}</h2>
                <p>{timeLabel(conflictTarget.startTime)}–{timeLabel(conflictTarget.endTime)} · Nothing has changed yet.</p>
                <div className="conflict-diff"><b>+ Added</b><span>{form.title} · {form.startTime}–{form.endTime}</span><b>! Existing</b><span>{conflictTarget.title} · {conflictTarget.startTime}–{conflictTarget.endTime}</span></div>
                {((minutes(conflictTarget.startTime) || 0) - (minutes(form.startTime) || 0) >= 30) && <button className="primary-action" onClick={() => chooseConflict("shorten")}>Shorten new event <small>Recommended</small></button>}
                <button className="primary-action" onClick={() => chooseConflict("shift")}>Start it later</button>
                {days.some((item) => item.date > form.date) && <button className="primary-action" onClick={() => chooseConflict("another")}>Put it on another day</button>}
                <button className="text-button" onClick={() => { setConflictTarget(undefined); setPanel("event"); }}>Pick a different time</button>
              </div>
            )}
            {panel === "delete" && deleteTarget && (
              <div className="event-form">
                <span className="section-label">LINKED EXPENSES</span>
                <h2>Remove “{deleteTarget.title}”?</h2>
                <p>This event has expenses linked to it. Choose what happens to those links.</p>
                <button className="primary-action" disabled={busy} onClick={() => void resolveDelete("unlink")}>Keep expenses unlinked</button>
                <label>Reassign to another event<select defaultValue="" onChange={(event) => { if (event.target.value) void resolveDelete("reassign", event.target.value); }}><option value="" disabled>Choose an event</option>{activities.filter((item) => item.id !== deleteTarget.id && !item.title.includes("(archived)")).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                <button className="text-button" onClick={() => { setDeleteTarget(undefined); setPanel(null); }}>Cancel</button>
              </div>
            )}
            {panel === "day" && (
              <div className="event-form">
                <span className="section-label">RESTRUCTURE THE TRIP</span>
                <h2>Insert a complete day</h2>
                <label>
                  Insert after
                  <select
                    value={addAfter}
                    onChange={(e) => setAddAfter(Number(e.target.value))}
                  >
                    {days.map((item) => (
                      <option key={item.id} value={item.dayNumber}>
                        Day {item.dayNumber} · {dateLabel(item.date)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Destination
                  <input
                    value={addLocation}
                    onChange={(e) => setAddLocation(e.target.value)}
                    placeholder="Same place or new halt"
                  />
                </label>
                <p className="fit-note">
                  {dayProposal ? `Day ${dayProposal.diff.added.dayNumber} will be added${dayProposal.diff.added.date ? ` on ${dateLabel(dayProposal.diff.added.date)}` : ""}. ${dayProposal.diff.shiftedDays || 0} later days shift; existing expenses stay unchanged.` : "Later days shift by one day. Existing expenses stay unchanged."}
                </p>
                {affectedStay && <label className="stay-choice"><input type="checkbox" checked={extendStay} onChange={(event) => setExtendStay(event.target.checked)} /> Extend {affectedStay.title} by one night</label>}
                {dayProposal && <div className="chosen-preview"><Check size={15} /> Review complete. Nothing has changed yet.</div>}
                {error && <p className="form-error">{error}</p>}
                <button
                  className="primary-action"
                  disabled={busy}
                  onClick={() => void addDay()}
                >
                  {busy ? "Preparing…" : "Add day"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
