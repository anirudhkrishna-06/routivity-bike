import { NextResponse } from "next/server";
import { getMoneyOverview } from "@/app/actions/money";
import { listTripActivities } from "@/app/actions/trips";
import { db } from "@/lib/db";
import { trips } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try { const { tripId } = await params; if (!db) throw new Error("Database is not configured"); const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) }); if (!trip) throw new Error("Trip not found"); const [activities, money] = await Promise.all([listTripActivities(tripId), getMoneyOverview(tripId)]); return NextResponse.json({ trip: { id: trip.id, name: trip.name, startDate: trip.startDate, endDate: trip.endDate, timezone: trip.timezone, currency: trip.currency }, activities, money, sync: { status: typeof navigator === "undefined" ? "online" : "online" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load dashboard." }, { status: 400 }); }
}
