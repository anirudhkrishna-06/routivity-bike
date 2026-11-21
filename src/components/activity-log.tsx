"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Event = { id: string; action: string; entityType: string; entityId: string; details: string; createdAt: string };
export function ActivityLog({ tripId }: { tripId: string }) {
  const [events, setEvents] = useState<Event[]>([]); const [error, setError] = useState("");
  useEffect(() => { void fetch("/api/trips/" + tripId + "/activity").then(async (response) => { const body = await response.json() as { events?: Event[]; error?: string }; if (response.ok) setEvents(body.events || []); else setError(body.error || "Unable to load the activity log."); }); }, [tripId]);
  return <main className="members-page"><div className="members-card"><Image src="/logo.png" alt="Routivity" width={150} height={54}/><span className="section-label">ACTIVITY LOG</span><h1>Every change, visible.</h1><p>A clear record of who changed the plan and when.</p>{error && <div className="auth-error">{error}</div>}<div className="member-list">{events.map((event) => <div className="member-line" key={event.id}><span>↗</span><div><b>{event.action} {event.entityType}</b><small>{new Date(event.createdAt).toLocaleString()} · {event.details}</small></div></div>)}</div></div></main>;
}
