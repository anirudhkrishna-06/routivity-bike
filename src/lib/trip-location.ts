import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { participants, tripMemberLocations } from "@/lib/db/schema";

export async function saveLatestLocation(input: { tripId: string; latitude: number; longitude: number; accuracyMeters?: number; locality?: string }) {
  const user = await getCurrentUser();
  if (!user || !db) throw new Error("Authentication required");
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) throw new Error("Invalid coordinates");
  if (input.accuracyMeters !== undefined && (!Number.isFinite(input.accuracyMeters) || input.accuracyMeters < 0 || input.accuracyMeters > 1000)) throw new Error("Location accuracy is too low");
  const member = await db.query.participants.findFirst({ where: and(eq(participants.tripId, input.tripId), eq(participants.userId, user.id), eq(participants.status, "active")) });
  if (!member) throw new Error("Trip membership required");
  await db.insert(tripMemberLocations).values({ participantId: member.id, latitude: input.latitude.toFixed(6), longitude: input.longitude.toFixed(6), accuracyMeters: input.accuracyMeters ? Math.round(input.accuracyMeters) : null, locality: input.locality?.slice(0, 160) || null, recordedAt: new Date() }).onConflictDoUpdate({ target: tripMemberLocations.participantId, set: { latitude: input.latitude.toFixed(6), longitude: input.longitude.toFixed(6), accuracyMeters: input.accuracyMeters ? Math.round(input.accuracyMeters) : null, locality: input.locality?.slice(0, 160) || null, recordedAt: new Date() } });
}
