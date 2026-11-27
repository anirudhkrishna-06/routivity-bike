import { NextResponse } from "next/server";

const apiKey = process.env.GEOAPIFY;

export async function GET(request: Request) {
  try {
    if (!apiKey) throw new Error("Geoapify is not configured");
    const key = apiKey;
    const text = new URL(request.url).searchParams.get("text")?.trim();
    if (!text || text.length < 2) return NextResponse.json({ features: [] });
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", text);
    url.searchParams.set("limit", "5");
    url.searchParams.set("format", "geojson");
    url.searchParams.set("apiKey", apiKey);
    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) throw new Error("Unable to search places");
    const body = await response.json() as { features?: unknown[] };
    return NextResponse.json({ features: body.features || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to search places" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    if (!apiKey) throw new Error("Geoapify is not configured");
    const key = apiKey;
    const body = await request.json() as { origin?: { lat: number; lon: number } | string; destination?: { lat: number; lon: number } | string; mode?: string };
    if (!body.origin || !body.destination) throw new Error("Origin and destination are required");
    async function resolve(value: { lat: number; lon: number } | string) {
      if (typeof value !== "string") return value;
      const search = new URL("https://api.geoapify.com/v1/geocode/search");
      search.searchParams.set("text", value); search.searchParams.set("limit", "1"); search.searchParams.set("apiKey", key);
      const response = await fetch(search, { next: { revalidate: 300 } });
      const result = await response.json() as { features?: { properties?: { lat?: number; lon?: number } }[] };
      const point = result.features?.[0]?.properties;
      if (!point?.lat || !point.lon) throw new Error(`Unable to locate ${value}`);
      return { lat: point.lat, lon: point.lon };
    }
    const origin = await resolve(body.origin); const destination = await resolve(body.destination);
    const url = new URL("https://api.geoapify.com/v1/routing");
    url.searchParams.set("waypoints", `${origin.lat},${origin.lon}|${destination.lat},${destination.lon}`);
    url.searchParams.set("mode", body.mode || "motorcycle");
    url.searchParams.set("apiKey", apiKey);
    const response = await fetch(url, { method: "GET", next: { revalidate: 300 } });
    if (!response.ok) throw new Error("Unable to calculate route");
    const result = await response.json() as { features?: { properties?: { distance?: number; time?: number } }[] };
    const properties = result.features?.[0]?.properties;
    if (!properties?.distance) throw new Error("No route found");
    return NextResponse.json({ distanceKm: properties.distance / 1000, durationMinutes: properties.time ? Math.round(properties.time / 60) : null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to calculate route" }, { status: 400 });
  }
}
