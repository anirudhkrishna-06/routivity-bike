const GOOGLE_HOSTS = new Set(["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]);

function isAllowedMapsUrl(value: string) {
  try { const url = new URL(value); return GOOGLE_HOSTS.has(url.hostname); } catch { return false; }
}

export function buildMapsUrl(input: { mapsUrl?: string; type: string; origin?: string; destination?: string; location?: string; locationLat?: number | null; locationLon?: number | null; viaPoints?: string }) {
  if (input.mapsUrl === "") return undefined;
  if (input.mapsUrl && isAllowedMapsUrl(input.mapsUrl)) return input.mapsUrl;
  if (input.type === "TRAVEL" && input.origin && input.destination) {
    const params = new URLSearchParams({ api: "1", origin: input.origin, destination: input.destination, travelmode: "two-wheeler" });
    if (input.viaPoints) params.set("waypoints", input.viaPoints);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  if (input.location) {
    const query = input.locationLat != null && input.locationLon != null
      ? `${input.locationLat},${input.locationLon}`
      : input.location;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return undefined;
}

export function buildLiveDirectionsUrl(destination: string, origin?: { lat: number; lon: number }) {
  const params = new URLSearchParams({
    api: "1",
    origin: origin ? `${origin.lat},${origin.lon}` : "Current Location",
    destination,
    travelmode: "two-wheeler",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function getLiveDirectionsUrl(destination: string) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(buildLiveDirectionsUrl(destination));
  }
  return new Promise<string>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(buildLiveDirectionsUrl(destination, { lat: position.coords.latitude, lon: position.coords.longitude })),
      () => resolve(buildLiveDirectionsUrl(destination)),
      { enableHighAccuracy: false, maximumAge: 120000, timeout: 5000 },
    );
  });
}
