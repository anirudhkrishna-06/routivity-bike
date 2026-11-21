const GOOGLE_HOSTS = new Set(["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"]);

function isAllowedMapsUrl(value: string) {
  try { const url = new URL(value); return GOOGLE_HOSTS.has(url.hostname); } catch { return false; }
}

export function buildMapsUrl(input: { mapsUrl?: string; type: string; origin?: string; destination?: string; location?: string; viaPoints?: string }) {
  if (input.mapsUrl && isAllowedMapsUrl(input.mapsUrl)) return input.mapsUrl;
  if (input.type === "TRAVEL" && input.origin && input.destination) {
    const params = new URLSearchParams({ api: "1", origin: input.origin, destination: input.destination, travelmode: "two-wheeler" });
    if (input.viaPoints) params.set("waypoints", input.viaPoints);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  if (input.location) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.location)}`;
  return undefined;
}
