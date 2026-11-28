"use client";
/* eslint-disable react-hooks/purity, react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Bug, MapPin, Navigation, RefreshCw } from "lucide-react";

type Location = { latitude: string; longitude: string; accuracyMeters: number | null; recordedAt: string; locality: string | null } | null;

export function ParentLocationMap({ location, destination }: { location: Location; destination?: string }) {
  const [debug, setDebug] = useState(false);
  const [debugLocation, setDebugLocation] = useState<Location>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      const params = new URLSearchParams(window.location.search);
      const enabled = params.get("mapDebug") === "1";
      setDebug(enabled);
      const latitude = Number(params.get("debugLat"));
      const longitude = Number(params.get("debugLon"));
      if (enabled && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        setDebugLocation({ latitude: String(latitude), longitude: String(longitude), accuracyMeters: 12, recordedAt: params.get("debugAt") || new Date().toISOString(), locality: params.get("debugLocality") || "Debug location" });
      }
    }
  }, []);

  const renderedLocation = location || debugLocation;
  if (!renderedLocation) {
    return <section className="trip-watch-map-section"><div className="trip-watch-map-empty"><Navigation size={24} /><h2>Location hasn’t been shared yet.</h2><p>The journey is still visible below. When a member actively uses Routivity and allows location access, their latest reported position will appear here.</p>{debug && <div className="trip-watch-map-debug"><div><Bug size={13} /><b>Map debugger</b></div><span>No latest location payload was returned.</span></div>}</div></section>;
  }

  const lat = Number(renderedLocation.latitude);
  const lon = Number(renderedLocation.longitude);
  const delta = 0.04;
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lon}`;
  const stale = Date.now() - new Date(renderedLocation.recordedAt).getTime() > 6 * 3600000;
  const externalUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

  return <section className="trip-watch-map-section"><div className="trip-watch-section-heading"><div><p className="trip-watch-eyebrow">LAST REPORTED LOCATION</p><h2>{renderedLocation.locality || destination || "Journey location"}</h2></div><span className="trip-watch-location-pin"><MapPin size={15} /> {debugLocation && !location ? "Debug preview" : stale ? "May be older" : "Reported location"}</span></div><div className="trip-watch-map-frame"><iframe key={reloadKey} title="Last reported trip location" src={embedUrl} loading="lazy" referrerPolicy="no-referrer" /><a href={externalUrl} target="_blank" rel="noreferrer">Open in Google Maps</a></div><p className="trip-watch-map-meta">Last location update: {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(renderedLocation.recordedAt))}{renderedLocation.accuracyMeters ? ` · Accuracy about ${renderedLocation.accuracyMeters} m` : ""}. {debugLocation && !location ? "Development preview payload; this is not a rider location." : stale ? "This may no longer represent the rider’s current position." : "This is a recent reported position, not continuous tracking."}</p>{debug && <div className="trip-watch-map-debug"><div><Bug size={13} /><b>Map debugger</b></div><code>lat {lat}, lon {lon}</code><code>bbox {bbox}</code><code>{embedUrl}</code><span>source: {debugLocation && !location ? "query fixture" : "database"} · stale: {String(stale)} · recorded: {renderedLocation.recordedAt}</span><div><button type="button" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw size={12} /> Reload embed</button><a href={embedUrl} target="_blank" rel="noreferrer">Open embed URL</a></div></div>}</section>;
}
