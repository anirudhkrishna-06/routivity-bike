"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

type State = "unknown" | "granted" | "denied" | "unavailable";

export function LiveLocationConsent({ compact = false, tripId }: { compact?: boolean; tripId?: string }) {
  const [state, setState] = useState<State>("unknown");
  const [busy, setBusy] = useState(false);

  function distance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
    const radians = Math.PI / 180;
    const x = (b.longitude - a.longitude) * radians * Math.cos(((a.latitude + b.latitude) / 2) * radians);
    const y = (b.latitude - a.latitude) * radians;
    return Math.sqrt(x * x + y * y) * 6371000;
  }

  function stamp() {
    if (!tripId || !navigator.geolocation || busy) return;
    const key = `routivity-location-${tripId}`;
    let previous: { latitude: number; longitude: number; recordedAt: number } | undefined;
    try { previous = JSON.parse(localStorage.getItem(key) || "null") as typeof previous; } catch {}
    if (previous && Date.now() - previous.recordedAt < 10 * 60 * 1000) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (position.coords.accuracy > 1000 || (previous && distance(previous, current) < 100)) { setBusy(false); return; }
      void fetch(`/api/trips/${tripId}/location`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: current.latitude, longitude: current.longitude, accuracyMeters: position.coords.accuracy }) }).finally(() => { localStorage.setItem(key, JSON.stringify({ ...current, recordedAt: Date.now() })); setState("granted"); setBusy(false); });
    }, () => { setState("denied"); setBusy(false); }, { enableHighAccuracy: false, maximumAge: 120000, timeout: 8000 });
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setState("unavailable");
      return;
    }
    if (navigator.permissions?.query) {
      void navigator.permissions.query({ name: "geolocation" }).then((permission) => {
        setState(permission.state === "granted" ? "granted" : permission.state === "denied" ? "denied" : "unknown");
        if (permission.state === "granted" && tripId) stamp();
        permission.onchange = () => setState(permission.state === "granted" ? "granted" : permission.state === "denied" ? "denied" : "unknown");
      }).catch(() => undefined);
    }
    }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    const onVisible = () => { if (document.visibilityState === "visible") stamp(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [tripId]);

  function request() {
    if (!navigator.geolocation) return;
    if (tripId) { stamp(); return; }
    setBusy(true); navigator.geolocation.getCurrentPosition(() => { setState("granted"); setBusy(false); }, () => { setState("denied"); setBusy(false); }, { enableHighAccuracy: false, maximumAge: 120000, timeout: 8000 });
  }

  if (state === "granted") return null;
  if (state === "unavailable") return <div className={`live-location-status ${compact ? "compact" : ""}`}><MapPin size={13} /> Live location is not available in this browser</div>;
  return <div className={`live-location-consent ${compact ? "compact" : ""}`}><span><MapPin size={13} /><span><b>{tripId ? "Share your latest location" : "Use your live location"}</b><small>{tripId ? "Only stamped while you actively use Routivity; no background tracking." : "Only used to start directions from where you are."}</small></span></span><button type="button" onClick={request} disabled={busy}>{busy ? "Checking…" : state === "denied" ? "Try again" : "Allow"}</button></div>;
}
