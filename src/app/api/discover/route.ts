import { NextResponse } from "next/server";
import { findDiscoverPlaces } from "@/lib/discover/suggestions";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const location = params.get("location")?.trim();
  if (!location || location.length < 2 || location.length > 120) return NextResponse.json({ error: "A destination is required." }, { status: 400 });
  const offset = Number(params.get("offset") || "0");
  if (!Number.isInteger(offset) || offset < 0 || offset > 500) return NextResponse.json({ error: "Invalid result page." }, { status: 400 });
  try { return NextResponse.json(await findDiscoverPlaces({ location, offset })); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Discover is temporarily unavailable." }, { status: 503 }); }
}
