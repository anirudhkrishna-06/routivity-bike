import { NextResponse } from "next/server";
import { getMoneyOverview } from "@/app/actions/money";
import { listTripActivities } from "@/app/actions/trips";
import { db } from "@/lib/db";
import { trips } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOrSetCache } from "@/lib/cache";

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const { tripId } = await params;
    if (!db) throw new Error("Database is not configured");
    const database = db;

    const payload = await getOrSetCache(`trip:${tripId}:dashboard`, 300, async () => {
      const trip = await database.query.trips.findFirst({ where: eq(trips.id, tripId) });
      if (!trip) throw new Error("Trip not found");
      const [activities, money] = await Promise.all([listTripActivities(tripId), getMoneyOverview(tripId)]);
      return {
        trip: { id: trip.id, name: trip.name, startDate: trip.startDate, endDate: trip.endDate, timezone: trip.timezone, currency: trip.currency },
        activities,
        money,
        sync: { status: "online" },
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load dashboard." }, { status: 400 });
  }
}
