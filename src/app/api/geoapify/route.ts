import { NextResponse } from "next/server";

const apiKey = process.env.GEOAPIFY;

export async function GET(request: Request) {
  try {
    if (!apiKey) throw new Error("Geoapify is not configured");
    const key = apiKey;
    const params = new URL(request.url).searchParams;
    const text = params.get("text")?.trim();
    const context = params.get("context")?.trim();
    if (!text || text.length < 2) return NextResponse.json({ features: [] });
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
    url.searchParams.set("text", text);
    url.searchParams.set("limit", "5");
    url.searchParams.set("format", "geojson");
    if (context) {
      const contextSearch = new URL("https://api.geoapify.com/v1/geocode/search");
      contextSearch.searchParams.set("text", context);
      contextSearch.searchParams.set("limit", "1");
      contextSearch.searchParams.set("apiKey", apiKey);
      const contextResponse = await fetch(contextSearch, { next: { revalidate: 3600 } });
      const contextBody = await contextResponse.json() as { features?: { properties?: { lat?: number; lon?: number } }[] };
      const point = contextBody.features?.[0]?.properties;
      if (point?.lat !== undefined && point.lon !== undefined) {
        url.searchParams.set("bias", `proximity:${point.lon},${point.lat}`);
        // Keep generic searches inside the active day's local area. Proximity
        // bias alone can still return a famous place from another city.
        url.searchParams.set("filter", `circle:${point.lon},${point.lat},40000`);
      }
    }
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
    const maps = new URL("https://www.google.com/maps/dir/");
    maps.searchParams.set("api", "1");
    maps.searchParams.set("origin", `${origin.lat},${origin.lon}`);
    maps.searchParams.set("destination", `${destination.lat},${destination.lon}`);
    maps.searchParams.set("travelmode", "two-wheeler");
    return NextResponse.json({
      distanceKm: properties.distance / 1000,
      durationMinutes: properties.time ? Math.round(properties.time / 60) : null,
      googleMapsUrl: maps.toString(),
      resolvedOrigin: origin,
      resolvedDestination: destination,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to calculate route" }, { status: 400 });
  }
}
