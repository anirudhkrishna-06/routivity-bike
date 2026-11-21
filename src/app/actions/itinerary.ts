"use server";

import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { activities, auditEvents, mutations, participants } from "@/lib/db/schema";
import { assertTripMember } from "@/lib/access";
import { invalidateTripCache } from "@/lib/cache";

type ActivityChange = { title?: string; status?: "planned" | "done" | "skipped"; dayId?: string; sortOrder?: number; startTime?: string; endTime?: string };

export async function saveItineraryChange(input: { tripId: string; activityId: string; idempotencyKey: string; change: ActivityChange }) {
  if (!db) throw new Error("Database is not configured");
  const userId = (await headers()).get("x-routivity-user-id");
  if (!userId) throw new Error("Authentication required");
  const membership = await db.query.participants.findFirst({ where: and(eq(participants.tripId, input.tripId), eq(participants.userId, userId)) });
  assertTripMember(membership ? { tripId: membership.tripId, userId: userId, status: membership.status, role: membership.role } : null, input.tripId);
  const existing = await db.query.mutations.findFirst({ where: eq(mutations.idempotencyKey, input.idempotencyKey) });
  if (existing) return JSON.parse(existing.result) as { activityId: string };
  const result = await db.transaction(async (tx) => {
    await tx.update(activities).set({ ...input.change, updatedAt: new Date() }).where(and(eq(activities.id, input.activityId), eq(activities.tripId, input.tripId)));
    await tx.insert(auditEvents).values({ tripId: input.tripId, actorId: userId, action: "updated", entityType: "activity", entityId: input.activityId, details: JSON.stringify(input.change) });
    const payload = { activityId: input.activityId };
    await tx.insert(mutations).values({ idempotencyKey: input.idempotencyKey, tripId: input.tripId, actorId: userId, result: JSON.stringify(payload) });
    return payload;
  });
  await invalidateTripCache(input.tripId);
  return result;
}
