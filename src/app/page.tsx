import { redirect } from "next/navigation";
import { connection } from "next/server";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { participants, trips } from "@/lib/db/schema";
import { AppShell } from "@/components/app-shell";

export const instant = false;

export default async function Home({ searchParams }: { searchParams: Promise<{ trip?: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!db) return <main className="empty-state"><h1>Database unavailable</h1><p>Configure DATABASE_URL to continue.</p></main>;

  const uniqueTrips = await db.selectDistinct({
    id: trips.id,
    name: trips.name,
    startDate: trips.startDate,
    endDate: trips.endDate,
    currency: trips.currency,
    timezone: trips.timezone,
  }).from(trips).innerJoin(participants, and(eq(participants.tripId, trips.id), eq(participants.userId, user.id), eq(participants.status, "active")));

  const query = await searchParams;
  return <AppShell user={{ name: user.name, email: user.email }} trips={uniqueTrips} initialTripId={query.trip} />;
}

