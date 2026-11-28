"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { RefreshCw } from "lucide-react";
import { ParentAccessScreen } from "./parent-access-screen";
import { ParentItinerary } from "./parent-itinerary";
import { ParentLiveContainer } from "./parent-live-container";
import { ParentLocationMap } from "./parent-location-map";

type Payload = { trip: { name: string; startDate: string; endDate: string; timezone: string }; days: { dayNumber: number; date: string; location: string | null }[]; activities: never[]; location: { latitude: string; longitude: string; accuracyMeters: number | null; recordedAt: string; locality: string | null } | null };

export function TripWatchPage({ shareToken }: { shareToken: string }) {
  const [payload, setPayload] = useState<Payload>();
  const [access, setAccess] = useState<"checking" | "required" | "ready" | "unavailable">("checking");
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { const response = await fetch(`/api/trip-watch/${shareToken}`, { cache: "no-store" }); if (response.status === 401) { setAccess("required"); return; } if (!response.ok) { setAccess("unavailable"); return; } setPayload(await response.json() as Payload); setAccess("ready"); }, [shareToken]);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 120000); return () => clearInterval(timer); }, [load]);
  async function refresh() { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }
  if (access === "checking") return <main className="trip-watch-loading"><span />Preparing the private journey view…</main>;
  if (access === "required") return <ParentAccessScreen shareToken={shareToken} onAccess={() => void load()} />;
  if (access === "unavailable" || !payload) return <main className="trip-watch-loading"><h1>This private link is unavailable.</h1><p>It may have expired or been revoked. Please ask the trip member for a new link.</p></main>;
  const destination = payload.days.find((day) => day.location)?.location || payload.trip.name;
  return <main className="trip-watch-page"><header className="trip-watch-brand"><Image src="/logo.png" alt="Routivity" width={150} height={54} priority /><button type="button" className={`trip-watch-refresh ${refreshing ? "refreshing" : ""}`} onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh journey" title="Refresh journey"><RefreshCw size={14} /></button></header><div className="trip-watch-content"><ParentLiveContainer trip={payload.trip} activities={payload.activities as never[]} /><ParentLocationMap location={payload.location} destination={destination} /><ParentItinerary days={payload.days} activities={payload.activities as never[]} startDate={payload.trip.startDate} endDate={payload.trip.endDate} /></div><footer className="trip-watch-footer">Shared privately by a Routivity trip member · read-only</footer></main>;
}
