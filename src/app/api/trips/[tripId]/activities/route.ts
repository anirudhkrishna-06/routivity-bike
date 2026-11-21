import { NextResponse } from "next/server";
import { listTripActivities } from "@/app/actions/trips";

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try { const { tripId } = await params; return NextResponse.json({ activities: await listTripActivities(tripId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load itinerary." }, { status: 400 }); }
}
