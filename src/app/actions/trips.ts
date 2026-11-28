"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { assertTripMember } from "@/lib/access";
import { db } from "@/lib/db";
import {
  activities,
  auditEvents,
  budgetRuleHistory,
  budgetRules,
  expensePayments,
  expenseRevisions,
  expenseShares,
  expenses,
  invitations,
  itineraryDays,
  mutations,
  participants,
  settlementRounds,
  settlementTransfers,
  trips,
  users,
  bikes,
  restructuringProposals,
  syncConflicts,
  tripJoinCodes,
} from "@/lib/db/schema";
import { invalidateTripCache } from "@/lib/cache";
import { buildMapsUrl } from "@/lib/maps";

type ActivityInput = {
  type: "TRAVEL" | "STAY" | "EXPLORATION" | "CUSTOM";
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  origin?: string;
  destination?: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  viaPoints?: string;
  mapsUrl?: string;
  distanceKmMilli?: number;
  bikeId?: string;
  status?: "planned" | "done" | "skipped";
  movable?: boolean;
  notes?: string;
  commitment?: "PLANNED" | "OPTIONAL" | "TENTATIVE" | "CONFIRMED";
  timeWindow?: string;
  durationMin?: number;
  travelMode?: string;
  stayNights?: number;
};
type BudgetInput = {
  category: string;
  ruleType: "PER_DAY" | "PER_NIGHT" | "TOTAL" | "DERIVED";
  amountPaise: number;
  effectiveFrom?: string;
};
type Db = NonNullable<typeof db>;
type Tx = Pick<Db, "select" | "insert" | "update">;

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
async function actor() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Authentication required");
  return user;
}
async function member(tripId: string, ownerOnly = false) {
  const user = await actor();
  if (!db) throw new Error("Database is not configured");
  const membership = await db.query.participants.findFirst({
    where: and(
      eq(participants.tripId, tripId),
      eq(participants.userId, user.id),
      eq(participants.status, "active"),
    ),
  });
  assertTripMember(
    membership
      ? {
          tripId,
          userId: user.id,
          status: membership.status,
          role: membership.role,
        }
      : null,
    tripId,
  );
  if (ownerOnly && membership?.role !== "owner")
    throw new Error("Owner access required");
  return { user, membership };
}
function datesBetween(start: string, end: string) {
  const dates: string[] = [];
  for (
    let cursor = new Date(start + "T00:00:00Z"),
      last = new Date(end + "T00:00:00Z");
    cursor <= last;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  )
    dates.push(cursor.toISOString().slice(0, 10));
  return dates;
}
function overlaps(
  aStart?: string | null,
  aEnd?: string | null,
  bStart?: string | null,
  bEnd?: string | null,
) {
  return Boolean(
    aStart && aEnd && bStart && bEnd && aStart < bEnd && bStart < aEnd,
  );
}
async function ensureNoOverlap(
  tx: Tx,
  tripId: string,
  dayId: string,
  startTime?: string | null,
  endTime?: string | null,
  exceptId?: string,
) {
  if (!startTime || !endTime) return;
  const existing = await tx
    .select({
      id: activities.id,
      title: activities.title,
      startTime: activities.startTime,
      endTime: activities.endTime,
    })
    .from(activities)
    .where(
      and(
        eq(activities.tripId, tripId),
        eq(activities.dayId, dayId),
        eq(activities.archived, false),
      ),
    );
  const conflict = existing.find(
    (item) =>
      item.id !== exceptId &&
      overlaps(startTime, endTime, item.startTime, item.endTime),
  );
  if (conflict)
    throw new Error("OVERLAP:" + conflict.id + ":" + conflict.title);
}
async function audit(
  tx: Tx,
  tripId: string,
  actorId: string,
  action: string,
  entityId: string,
  details: unknown,
) {
  await tx
    .insert(auditEvents)
    .values({
      tripId,
      actorId,
      action,
      entityType: "itinerary",
      entityId,
      details: JSON.stringify(details),
    });
}
async function participantRows(
  tx: Tx,
  tripId: string,
  members: { name: string; email?: string }[],
  owner: { name: string; email: string; id: string },
  ownerMemberName?: string,
) {
  const selectedName = ownerMemberName?.trim().toLowerCase();
  const selectedIndex = members.findIndex(
    (item) => selectedName && item.name.trim().toLowerCase() === selectedName,
  );
  const ownerInMembers =
    selectedIndex >= 0 ||
    members.some(
      (item) => item.email?.trim().toLowerCase() === owner.email.toLowerCase(),
    );

  const emails = Array.from(
    new Set(
      members
        .map((item) => item.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e)),
    ),
  );
  const userMap = new Map<string, string>();
  if (emails.length) {
    const matched = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, emails));
    for (const u of matched) userMap.set(u.email.toLowerCase(), u.id);
  }

  const rows: {
    tripId: string;
    name: string;
    email?: string;
    userId: string | null;
    role: "owner" | "member";
  }[] = [];
  for (const item of members) {
    const email = item.email?.trim().toLowerCase();
    const isOwnerMember =
      (selectedName && item.name.trim().toLowerCase() === selectedName) ||
      (email && email === owner.email.toLowerCase()) ||
      (!ownerMemberName &&
        item.name.trim().toLowerCase() === owner.name.trim().toLowerCase());
    const linkedId = email ? (userMap.get(email) ?? null) : null;
    rows.push({
      tripId,
      name: item.name.trim(),
      email,
      userId: isOwnerMember ? owner.id : linkedId,
      role: isOwnerMember ? "owner" : "member",
    });
  }
  if (!ownerInMembers)
    rows.unshift({
      tripId,
      name: owner.name,
      email: owner.email,
      userId: owner.id,
      role: "owner",
    });
  return rows;
}

export async function createTrip(input: {
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
  currency?: string;
  members?: { name: string; email?: string }[];
}) {
  const user = await actor();
  if (!db) throw new Error("Database is not configured");
  if (!input.name.trim() || input.startDate > input.endDate)
    throw new Error("Trip name and valid dates are required");
  const result = await db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(trips)
      .values({
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        timezone: input.timezone,
        currency: input.currency || "INR",
        createdBy: user.id,
      })
      .returning();
    const days = await tx
      .insert(itineraryDays)
      .values(
        datesBetween(input.startDate, input.endDate).map((date, index) => ({
          tripId: trip.id,
          dayNumber: index + 1,
          date,
        })),
      )
      .returning();
    const members = await participantRows(
      tx,
      trip.id,
      input.members || [],
      user,
    );
    await tx.insert(participants).values(members);
    await audit(tx, trip.id, user.id, "created", trip.id, {
      days: days.length,
      members: members.length,
    });
    return trip;
  });
  await invalidateTripCache(result.id);
  return result;
}

export async function createInvite(input: {
  tripId: string;
  name: string;
  email?: string;
}) {
  const { user } = await member(input.tripId, true);
  if (!db) throw new Error("Database is not configured");
  const [participant] = await db
    .insert(participants)
    .values({
      tripId: input.tripId,
      name: input.name.trim(),
      email: input.email?.trim().toLowerCase(),
    })
    .returning();
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db
    .insert(invitations)
    .values({
      tripId: input.tripId,
      participantId: participant.id,
      tokenHash: tokenHash(rawToken),
      expiresAt,
    });
  await db
    .insert(auditEvents)
    .values({
      tripId: input.tripId,
      actorId: user.id,
      action: "invited",
      entityType: "participant",
      entityId: participant.id,
      details: JSON.stringify({ email: input.email }),
    });
  return {
    inviteUrl: "/invite/" + rawToken,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function listTripMembers(tripId: string) {
  await member(tripId);
  if (!db) throw new Error("Database is not configured");
  return db.query.participants.findMany({
    where: eq(participants.tripId, tripId),
  });
}

function joinCode() {
  return `RVTY-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createTripJoinCode(tripId: string) {
  const { user } = await member(tripId, true);
  if (!db) throw new Error("Database is not configured");
  const code = joinCode();
  const expiresAt = new Date(Date.now() + 30 * 86400000);
  await db
    .update(tripJoinCodes)
    .set({ active: false })
    .where(eq(tripJoinCodes.tripId, tripId));
  await db
    .insert(tripJoinCodes)
    .values({
      tripId,
      codeHash: tokenHash(code),
      expiresAt,
      createdBy: user.id,
    });
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  return {
    code,
    shareUrl: `/join?code=${encodeURIComponent(code)}`,
    expiresAt: expiresAt.toISOString(),
    tripName: trip?.name || "Trip",
  };
}

export async function lookupTripJoinCode(rawCode: string) {
  if (!db) throw new Error("Database is not configured");
  const code = rawCode.trim().toUpperCase();
  const join = await db.query.tripJoinCodes.findFirst({
    where: and(
      eq(tripJoinCodes.codeHash, tokenHash(code)),
      eq(tripJoinCodes.active, true),
      gte(tripJoinCodes.expiresAt, new Date()),
    ),
  });
  if (!join) throw new Error("That sharing code is invalid or expired");
  const trip = await db.query.trips.findFirst({
    where: eq(trips.id, join.tripId),
  });
  const candidates = await db.query.participants.findMany({
    where: and(
      eq(participants.tripId, join.tripId),
      eq(participants.status, "active"),
    ),
  });
  return {
    trip: trip ? { id: trip.id, name: trip.name } : null,
    candidates: candidates
      .filter((item) => !item.userId)
      .map((item) => ({ id: item.id, name: item.name })),
  };
}

export async function acceptTripJoinCode(input: {
  code: string;
  participantId: string;
}) {
  const user = await actor();
  if (!db) throw new Error("Database is not configured");
  const code = input.code.trim().toUpperCase();
  const join = await db.query.tripJoinCodes.findFirst({
    where: and(
      eq(tripJoinCodes.codeHash, tokenHash(code)),
      eq(tripJoinCodes.active, true),
      gte(tripJoinCodes.expiresAt, new Date()),
    ),
  });
  if (!join) throw new Error("That sharing code is invalid or expired");
  const participant = await db.query.participants.findFirst({
    where: and(
      eq(participants.id, input.participantId),
      eq(participants.tripId, join.tripId),
      eq(participants.status, "active"),
    ),
  });
  if (!participant) throw new Error("Choose a valid trip member");
  const existing = await db.query.participants.findFirst({
    where: and(
      eq(participants.tripId, join.tripId),
      eq(participants.userId, user.id),
      eq(participants.status, "active"),
    ),
  });
  if (existing && existing.id !== participant.id)
    throw new Error(`You already joined this trip as ${existing.name}`);
  if (participant.userId && participant.userId !== user.id)
    throw new Error("That member slot is already claimed");
  await db.transaction(async (tx) => {
    await tx
      .update(participants)
      .set({ userId: user.id, email: user.email })
      .where(eq(participants.id, participant.id));
    await audit(tx, join.tripId, user.id, "joined-by-code", participant.id, {
      memberName: participant.name,
    });
  });
  return { tripId: join.tripId };
}

export async function listTripActivities(tripId: string) {
  await member(tripId);
  if (!db) throw new Error("Database is not configured");
  return db
    .select({
      id: activities.id,
      dayNumber: itineraryDays.dayNumber,
      date: itineraryDays.date,
      type: activities.type,
      title: activities.title,
      startTime: activities.startTime,
      endTime: activities.endTime,
      origin: activities.origin,
      destination: activities.destination,
      location: activities.location,
      locationLat: activities.locationLat,
      locationLon: activities.locationLon,
      mapsUrl: activities.mapsUrl,
      notes: activities.notes,
      commitment: activities.commitment,
      timeWindow: activities.timeWindow,
      durationMin: activities.durationMin,
      travelMode: activities.travelMode,
      stayNights: activities.stayNights,
      distanceKmMilli: activities.distanceKmMilli,
      bikeId: activities.bikeId,
      status: activities.status,
      sortOrder: activities.sortOrder,
    })
    .from(activities)
    .innerJoin(itineraryDays, eq(activities.dayId, itineraryDays.id))
    .where(and(eq(activities.tripId, tripId), eq(activities.archived, false)))
    .orderBy(asc(activities.sortOrder));
}

export async function listTripDays(tripId: string) {
  await member(tripId);
  if (!db) throw new Error("Database is not configured");
  return db.query.itineraryDays.findMany({
    where: eq(itineraryDays.tripId, tripId),
    orderBy: (row, { asc }) => [asc(row.dayNumber)],
  });
}

export async function acceptInvite(rawToken: string) {
  const user = await actor();
  if (!db) throw new Error("Database is not configured");
  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.tokenHash, tokenHash(rawToken)),
      gte(invitations.expiresAt, new Date()),
    ),
  });
  if (!invitation || invitation.acceptedAt)
    throw new Error("This invite is invalid or expired");
  await db.transaction(async (tx) => {
    await tx
      .update(participants)
      .set({ userId: user.id, email: user.email, name: user.name })
      .where(eq(participants.id, invitation.participantId));
    await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));
    await audit(
      tx,
      invitation.tripId,
      user.id,
      "joined",
      invitation.participantId,
      {},
    );
  });
  return { tripId: invitation.tripId };
}

export async function importTrip(input: {
  idempotencyKey: string;
  trip: {
    name: string;
    startDate: string;
    endDate: string;
    timezone: string;
    currency?: string;
  };
  members: { name: string; email?: string }[];
  authMemberName?: string;
  activities: ActivityInput[];
  budgets?: BudgetInput[];
  days?: { date: string; location?: string }[];
}) {
  const user = await actor();
  if (!db) throw new Error("Database is not configured");
  const existing = await db.query.mutations.findFirst({
    where: eq(mutations.idempotencyKey, input.idempotencyKey),
  });
  if (existing) return JSON.parse(existing.result) as { tripId: string };
  const result = await db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(trips)
      .values({
        name: input.trip.name,
        startDate: input.trip.startDate,
        endDate: input.trip.endDate,
        timezone: input.trip.timezone,
        currency: input.trip.currency || "INR",
        createdBy: user.id,
      })
      .returning();
    const dates = datesBetween(input.trip.startDate, input.trip.endDate);
    const dayLocations = new Map(
      (input.days || []).map((day) => [day.date, day.location || null]),
    );
    const days = await tx
      .insert(itineraryDays)
      .values(
        dates.map((date, index) => ({
          tripId: trip.id,
          dayNumber: index + 1,
          date,
          location: dayLocations.get(date) || null,
        })),
      )
      .returning();
    await tx
      .insert(participants)
      .values(
        await participantRows(
          tx,
          trip.id,
          input.members,
          user,
          input.authMemberName,
        ),
      );
    if (input.budgets?.length)
      await tx
        .insert(budgetRules)
        .values(
          input.budgets.map((rule) => ({
            tripId: trip.id,
            category: rule.category,
            ruleType: rule.ruleType,
            amountPaise: rule.amountPaise,
            effectiveFrom: rule.effectiveFrom || trip.startDate,
            createdBy: user.id,
          })),
        );
    for (const [index, item] of input.activities.entries()) {
      const day = days.find((candidate) => candidate.date === item.date);
      if (!day) throw new Error(`Activity date ${item.date} is outside the trip`);
      await ensureNoOverlap(tx, trip.id, day.id, item.startTime, item.endTime);
      await tx
        .insert(activities)
        .values({
          tripId: trip.id,
          dayId: day.id,
          type: item.type,
          title: item.title,
          startTime: item.startTime,
          endTime: item.endTime,
          origin: item.origin,
          destination: item.destination,
          location: item.location,
          viaPoints: item.viaPoints,
          mapsUrl: buildMapsUrl(item),
          distanceKmMilli: item.distanceKmMilli,
          bikeId: item.bikeId,
          notes: item.notes,
          commitment: item.commitment || "PLANNED",
          timeWindow: item.timeWindow,
          durationMin: item.durationMin,
          travelMode: item.travelMode,
          stayNights: item.stayNights,
          status: item.status || "planned",
          movable: item.movable ?? item.commitment !== "CONFIRMED",
          sortOrder: index,
        });
    }
    const payload = { tripId: trip.id };
    await audit(tx, trip.id, user.id, "imported", trip.id, {
      activities: input.activities.length,
      budgets: input.budgets?.length || 0,
    });
    await tx
      .insert(mutations)
      .values({
        idempotencyKey: input.idempotencyKey,
        tripId: trip.id,
        actorId: user.id,
        result: JSON.stringify(payload),
      });
    return payload;
  });
  await invalidateTripCache(result.tripId);
  return result;
}

export async function createActivity(input: {
  tripId: string;
  idempotencyKey: string;
  activity: ActivityInput;
}) {
  const { user } = await member(input.tripId);
  if (!db) throw new Error("Database is not configured");
  const day = await db.query.itineraryDays.findFirst({
    where: and(
      eq(itineraryDays.tripId, input.tripId),
      eq(itineraryDays.date, input.activity.date),
    ),
  });
  if (!day) throw new Error("Activity date is outside the trip");
  const configuredBike = input.activity.type === "TRAVEL" && !input.activity.bikeId
    ? await db.query.bikes.findFirst({ where: eq(bikes.tripId, input.tripId) })
    : undefined;
  const result = await db.transaction(async (tx) => {
    await ensureNoOverlap(
      tx,
      input.tripId,
      day.id,
      input.activity.startTime,
      input.activity.endTime,
    );
    const [created] = await tx
      .insert(activities)
      .values({
        tripId: input.tripId,
        dayId: day.id,
        type: input.activity.type,
        title: input.activity.title,
        startTime: input.activity.startTime,
        endTime: input.activity.endTime,
        origin: input.activity.origin,
        destination: input.activity.destination,
        location: input.activity.location,
        locationLat: input.activity.locationLat,
        locationLon: input.activity.locationLon,
        viaPoints: input.activity.viaPoints,
        mapsUrl: buildMapsUrl(input.activity),
        notes: input.activity.notes,
        commitment: input.activity.commitment || "PLANNED",
        timeWindow: input.activity.timeWindow,
        durationMin: input.activity.durationMin,
        travelMode: input.activity.travelMode,
        bikeId: input.activity.bikeId ?? configuredBike?.id,
        stayNights: input.activity.stayNights,
        status: input.activity.status || "planned",
        movable:
          input.activity.movable ?? input.activity.commitment !== "CONFIRMED",
      })
      .returning();
    await audit(
      tx,
      input.tripId,
      user.id,
      "created",
      created.id,
      input.activity,
    );
    return created;
  });
  await invalidateTripCache(input.tripId);
  return result;
}

export async function updateActivity(input: {
  tripId: string;
  activityId: string;
  change: Partial<ActivityInput>;
  idempotencyKey: string;
}) {
  const { user } = await member(input.tripId);
  if (!db) throw new Error("Database is not configured");
  const existingMutation = await db.query.mutations.findFirst({ where: eq(mutations.idempotencyKey, input.idempotencyKey) });
  if (existingMutation) return JSON.parse(existingMutation.result);
  if (Object.keys(input.change).length === 1 && input.change.status) {
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(activities).set({ status: input.change.status, updatedAt: new Date() }).where(and(eq(activities.id, input.activityId), eq(activities.tripId, input.tripId), eq(activities.archived, false))).returning({ id: activities.id, status: activities.status });
      if (!updated) throw new Error("Activity not found");
      await audit(tx, input.tripId, user.id, "updated", input.activityId, input.change);
      await tx.insert(mutations).values({ idempotencyKey: input.idempotencyKey, tripId: input.tripId, actorId: user.id, result: JSON.stringify(updated) });
      return updated;
    });
    await invalidateTripCache(input.tripId);
    return result;
  }
  const current = await db.query.activities.findFirst({
    where: and(
      eq(activities.id, input.activityId),
      eq(activities.tripId, input.tripId),
      eq(activities.archived, false),
    ),
  });
  if (!current) throw new Error("Activity not found");
  const day = input.change.date
    ? await db.query.itineraryDays.findFirst({
        where: and(
          eq(itineraryDays.tripId, input.tripId),
          eq(itineraryDays.date, input.change.date),
        ),
      })
    : await db.query.itineraryDays.findFirst({
        where: eq(itineraryDays.id, current.dayId),
      });
  if (!day) throw new Error("Activity date is outside the trip");
  const result = await db.transaction(async (tx) => {
    await ensureNoOverlap(
      tx,
      input.tripId,
      day.id,
      input.change.startTime ?? current.startTime,
      input.change.endTime ?? current.endTime,
      input.activityId,
    );
    const [updated] = await tx
      .update(activities)
      .set({
        dayId: day.id,
        title: input.change.title ?? current.title,
        type: input.change.type ?? current.type,
        startTime: input.change.startTime ?? current.startTime,
        endTime: input.change.endTime ?? current.endTime,
        origin: input.change.origin ?? current.origin,
        destination: input.change.destination ?? current.destination,
        location: input.change.location ?? current.location,
        locationLat: input.change.locationLat ?? current.locationLat,
        locationLon: input.change.locationLon ?? current.locationLon,
        viaPoints: input.change.viaPoints ?? current.viaPoints,
        mapsUrl: buildMapsUrl({
          ...current,
          ...input.change,
          mapsUrl: input.change.mapsUrl !== undefined ? input.change.mapsUrl : current.mapsUrl ?? undefined,
          origin: current.origin ?? undefined,
          destination: current.destination ?? undefined,
          location: current.location ?? undefined,
          viaPoints: current.viaPoints ?? undefined,
          type: input.change.type ?? current.type,
        }),
        notes: input.change.notes ?? current.notes,
        commitment: input.change.commitment ?? current.commitment,
        timeWindow: input.change.timeWindow ?? current.timeWindow,
        durationMin: input.change.durationMin ?? current.durationMin,
        travelMode: input.change.travelMode ?? current.travelMode,
        stayNights: input.change.stayNights ?? current.stayNights,
        status: input.change.status ?? current.status,
        movable:
          input.change.movable ??
          (input.change.commitment === "CONFIRMED" ? false : current.movable),
        updatedAt: new Date(),
      })
      .where(eq(activities.id, input.activityId))
      .returning();
    await audit(
      tx,
      input.tripId,
      user.id,
      "updated",
      input.activityId,
      input.change,
    );
    return updated;
  });
  await invalidateTripCache(input.tripId);
  return result;
}

export async function deleteActivity(input: {
  tripId: string;
  activityId: string;
  resolution?: { mode: "unlink" | "reassign"; targetActivityId?: string };
  idempotencyKey: string;
}) {
  const { user } = await member(input.tripId);
  if (!db) throw new Error("Database is not configured");
  const linked = await db.query.expenses.findMany({
    where: and(
      eq(expenses.tripId, input.tripId),
      eq(expenses.activityId, input.activityId),
    ),
  });
  if (linked.length && !input.resolution)
    throw new Error("EXPENSE_LINKED:" + linked.length);
  if (
    input.resolution?.mode === "reassign" &&
    !input.resolution.targetActivityId
  )
    throw new Error("Choose another activity for linked expenses");
  const result = await db.transaction(async (tx) => {
    if (linked.length && input.resolution?.mode === "unlink")
      await tx
        .update(expenses)
        .set({ activityId: null })
        .where(eq(expenses.activityId, input.activityId));
    if (linked.length && input.resolution?.mode === "reassign")
      await tx
        .update(expenses)
        .set({ activityId: input.resolution.targetActivityId })
        .where(eq(expenses.activityId, input.activityId));
    await tx
      .update(activities)
      .set({ archived: true, updatedAt: new Date() })
      .where(eq(activities.id, input.activityId));
    await audit(
      tx,
      input.tripId,
      user.id,
      "deleted",
      input.activityId,
      input.resolution || {},
    );
    return { activityId: input.activityId };
  });
  await invalidateTripCache(input.tripId);
  return result;
}

export async function restoreActivity(input: { tripId: string; activityId: string; idempotencyKey: string }) {
  const { user } = await member(input.tripId); if (!db) throw new Error("Database is not configured");
  const existing = await db.query.mutations.findFirst({ where: eq(mutations.idempotencyKey, input.idempotencyKey) }); if (existing) return JSON.parse(existing.result);
  const result = await db.transaction(async (tx) => { await tx.update(activities).set({ archived: false, updatedAt: new Date() }).where(and(eq(activities.id, input.activityId), eq(activities.tripId, input.tripId))); await audit(tx, input.tripId, user.id, "restored", input.activityId, {}); const payload = { activityId: input.activityId }; await tx.insert(mutations).values({ idempotencyKey: input.idempotencyKey, tripId: input.tripId, actorId: user.id, result: JSON.stringify(payload) }); return payload; }); await invalidateTripCache(input.tripId); return result;
}

export async function duplicateActivity(input: {
  tripId: string;
  activityId: string;
  idempotencyKey: string;
}) {
  const { user } = await member(input.tripId);
  if (!db) throw new Error("Database is not configured");
  const current = await db.query.activities.findFirst({
    where: and(
      eq(activities.id, input.activityId),
      eq(activities.tripId, input.tripId),
      eq(activities.archived, false),
    ),
  });
  if (!current) throw new Error("Activity not found");
  const result = await db.transaction(async (tx) => {
    await ensureNoOverlap(
      tx,
      input.tripId,
      current.dayId,
      current.startTime,
      current.endTime,
    );
    const [copy] = await tx
      .insert(activities)
      .values({
        tripId: current.tripId,
        dayId: current.dayId,
        type: current.type,
        title: current.title + " (copy)",
        startTime: current.startTime,
        endTime: current.endTime,
        origin: current.origin,
        destination: current.destination,
        location: current.location,
        mapsUrl: current.mapsUrl,
        viaPoints: current.viaPoints,
        bikeId: current.bikeId,
        status: "planned",
        movable: current.movable,
        sortOrder: current.sortOrder + 1,
      })
      .returning();
    await audit(tx, input.tripId, user.id, "duplicated", copy.id, {
      source: input.activityId,
    });
    return copy;
  });
  await invalidateTripCache(input.tripId);
  return result;
}

export async function moveActivity(input: {
  tripId: string;
  activityId: string;
  date: string;
  idempotencyKey: string;
}) {
  const current = await db?.query.activities.findFirst({
    where: and(
      eq(activities.id, input.activityId),
      eq(activities.tripId, input.tripId),
    ),
  });
  if (!current) throw new Error("Activity not found");
  return updateActivity({
    tripId: input.tripId,
    activityId: input.activityId,
    idempotencyKey: input.idempotencyKey,
    change: {
      date: input.date,
      startTime: current.startTime ?? undefined,
      endTime: current.endTime ?? undefined,
    },
  });
}

export async function listActivityLog(tripId: string) {
  await member(tripId);
  if (!db) throw new Error("Database is not configured");
  return db.query.auditEvents.findMany({
    where: eq(auditEvents.tripId, tripId),
    orderBy: (events, { desc }) => [desc(events.createdAt)],
    limit: 100,
  });
}

export async function deleteTrip(tripId: string, reason: string) {
  const { user } = await member(tripId, true);
  if (!reason.trim()) throw new Error("A deletion reason is required");
  await db!.transaction(async (tx) => {
    const expenseIds = (
      await tx
        .select({ id: expenses.id })
        .from(expenses)
        .where(eq(expenses.tripId, tripId))
    ).map((row) => row.id);
    const ruleIds = (
      await tx
        .select({ id: budgetRules.id })
        .from(budgetRules)
        .where(eq(budgetRules.tripId, tripId))
    ).map((row) => row.id);
    const roundIds = (
      await tx
        .select({ id: settlementRounds.id })
        .from(settlementRounds)
        .where(eq(settlementRounds.tripId, tripId))
    ).map((row) => row.id);
    if (expenseIds.length) {
      await tx
        .delete(expensePayments)
        .where(inArray(expensePayments.expenseId, expenseIds));
      await tx
        .delete(expenseShares)
        .where(inArray(expenseShares.expenseId, expenseIds));
      await tx
        .delete(expenseRevisions)
        .where(inArray(expenseRevisions.expenseId, expenseIds));
    }
    if (ruleIds.length)
      await tx
        .delete(budgetRuleHistory)
        .where(inArray(budgetRuleHistory.budgetRuleId, ruleIds));
    if (roundIds.length)
      await tx
        .delete(settlementTransfers)
        .where(inArray(settlementTransfers.roundId, roundIds));
    await tx
      .delete(settlementTransfers)
      .where(eq(settlementTransfers.tripId, tripId));
    await tx
      .delete(settlementRounds)
      .where(eq(settlementRounds.tripId, tripId));
    await tx.delete(budgetRules).where(eq(budgetRules.tripId, tripId));
    await tx.delete(expenses).where(eq(expenses.tripId, tripId));
    await tx.delete(mutations).where(eq(mutations.tripId, tripId));
    await tx
      .delete(restructuringProposals)
      .where(eq(restructuringProposals.tripId, tripId));
    await tx.delete(syncConflicts).where(eq(syncConflicts.tripId, tripId));
    await tx.delete(auditEvents).where(eq(auditEvents.tripId, tripId));
    await tx.delete(invitations).where(eq(invitations.tripId, tripId));
    await tx.delete(tripJoinCodes).where(eq(tripJoinCodes.tripId, tripId));
    await tx.delete(activities).where(eq(activities.tripId, tripId));
    await tx.delete(bikes).where(eq(bikes.tripId, tripId));
    await tx.delete(itineraryDays).where(eq(itineraryDays.tripId, tripId));
    await tx.delete(participants).where(eq(participants.tripId, tripId));
    await tx.delete(trips).where(eq(trips.id, tripId));
  });
  await invalidateTripCache(tripId);
  return { tripId, deletedBy: user.id };
}

type ScheduleSnapshot = {
  trip: { startDate: string; endDate: string };
  days: {
    id: string;
    dayNumber: number;
    date: string;
    location: string | null;
  }[];
  activities: {
    id: string;
    dayId: string;
    startTime: string | null;
    endTime: string | null;
    sortOrder: number;
    archived: boolean;
  }[];
};
function shiftDate(value: string, days: number) {
  const next = new Date(`${value}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
async function scheduleSnapshot(tripId: string): Promise<ScheduleSnapshot> {
  if (!db) throw new Error("Database is not configured");
  const [trip, days, activityRows] = await Promise.all([
    db.query.trips.findFirst({ where: eq(trips.id, tripId) }),
    db.query.itineraryDays.findMany({
      where: eq(itineraryDays.tripId, tripId),
      orderBy: (row, { asc }) => [asc(row.dayNumber)],
    }),
    db.query.activities.findMany({ where: eq(activities.tripId, tripId) }),
  ]);
  if (!trip) throw new Error("Trip not found");
  return {
    trip: { startDate: trip.startDate, endDate: trip.endDate },
    days: days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: day.date,
      location: day.location,
    })),
    activities: activityRows.map((item) => ({
      id: item.id,
      dayId: item.dayId,
      startTime: item.startTime,
      endTime: item.endTime,
      sortOrder: item.sortOrder,
      archived: item.archived,
    })),
  };
}

export async function proposeAddDay(input: {
  tripId: string;
  afterDayNumber: number;
  locationHint?: string;
}) {
  const { user } = await member(input.tripId);
  if (!db) throw new Error("Database is not configured");
  const before = await scheduleSnapshot(input.tripId);
  const anchor = before.days.find(
    (day) => day.dayNumber === input.afterDayNumber,
  );
  if (!anchor) throw new Error("Choose an existing trip day");
  const after: ScheduleSnapshot = {
    trip: { ...before.trip, endDate: shiftDate(before.trip.endDate, 1) },
    days: before.days.flatMap((day) =>
      day.dayNumber <= input.afterDayNumber
        ? [day]
        : [
            {
              ...day,
              dayNumber: day.dayNumber + 1,
              date: shiftDate(day.date, 1),
            },
          ],
    ),
    activities: before.activities,
  };
  const inserted = {
    id: "new-day",
    dayNumber: input.afterDayNumber + 1,
    date: shiftDate(anchor.date, 1),
    location: input.locationHint || anchor.location,
  };
  after.days.splice(input.afterDayNumber, 0, inserted);
  const shifted = before.days.filter(
    (day) => day.dayNumber > input.afterDayNumber,
  ).length;
  const diff = {
    kind: "add-day",
    locationHint: input.locationHint || null,
    added: inserted,
    shiftedDays: shifted,
    budgetImpact:
      "Per-day rules will include the added day; existing expenses remain unchanged.",
  };
  const [proposal] = await db
    .insert(restructuringProposals)
    .values({
      tripId: input.tripId,
      kind: "add-day",
      beforeSnapshot: before,
      afterSnapshot: after,
      diff,
      createdBy: user.id,
    })
    .returning();
  return { proposal, diff };
}

export async function proposeMoveActivity(input: {
  tripId: string;
  activityId: string;
  targetDate?: string;
  mode?: "same-day" | "move-day" | "replace";
}) {
  const { user } = await member(input.tripId);
  if (!db) throw new Error("Database is not configured");
  const current = await db.query.activities.findFirst({
    where: and(
      eq(activities.id, input.activityId),
      eq(activities.tripId, input.tripId),
      eq(activities.archived, false),
    ),
  });
  if (!current) throw new Error("Activity not found");
  if (!current.movable)
    throw new Error("This activity is fixed and cannot be moved automatically");
  const snapshot = await scheduleSnapshot(input.tripId);
  const currentDay = snapshot.days.find((day) => day.id === current.dayId);
  if (!currentDay) throw new Error("Activity day not found");
  const target = input.targetDate
    ? snapshot.days.find((day) => day.date === input.targetDate)
    : snapshot.days.find(
        (day) =>
          day.id !== current.dayId &&
          (!current.location ||
            !day.location ||
            day.location
              .toLowerCase()
              .includes(current.location.toLowerCase()) ||
            current.location
              .toLowerCase()
              .includes(day.location.toLowerCase())),
      );
  if (!target)
    throw new Error("No compatible day is available for this activity");
  const collision = snapshot.activities.find(
    (item) =>
      item.id !== current.id &&
      item.dayId === target.id &&
      item.startTime &&
      item.endTime &&
      current.startTime &&
      current.endTime &&
      overlaps(
        item.startTime,
        item.endTime,
        current.startTime,
        current.endTime,
      ),
  );
  if (collision && input.mode !== "replace")
    throw new Error("NO_SLOT:" + collision.id);
  const after: ScheduleSnapshot = {
    ...snapshot,
    activities: snapshot.activities.map((item) =>
      item.id === current.id ? { ...item, dayId: target.id } : item,
    ),
  };
  const diff = {
    kind: "move-activity",
    activityId: current.id,
    title: current.title,
    from: { day: currentDay.dayNumber, date: currentDay.date },
    to: { day: target.dayNumber, date: target.date, location: target.location },
    mode: input.mode || "move-day",
    collision: collision?.id || null,
    expensesUntouched: true,
  };
  const [proposal] = await db
    .insert(restructuringProposals)
    .values({
      tripId: input.tripId,
      kind: "move-activity",
      beforeSnapshot: snapshot,
      afterSnapshot: after,
      diff,
      createdBy: user.id,
    })
    .returning();
  return { proposal, diff };
}

export async function applyRestructuringProposal(input: {
  tripId: string;
  proposalId: string;
}) {
  const { user } = await member(input.tripId);
  if (!db) throw new Error("Database is not configured");
  const proposal = await db.query.restructuringProposals.findFirst({
    where: and(
      eq(restructuringProposals.id, input.proposalId),
      eq(restructuringProposals.tripId, input.tripId),
    ),
  });
  if (!proposal || proposal.status !== "proposed")
    throw new Error("Proposal is no longer available");
  const after = proposal.afterSnapshot as ScheduleSnapshot;
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: itineraryDays.id })
      .from(itineraryDays)
      .where(eq(itineraryDays.tripId, input.tripId));
    await tx
      .update(trips)
      .set({ endDate: after.trip.endDate, updatedAt: new Date() })
      .where(eq(trips.id, input.tripId));
    for (const [index, row] of existing.entries())
      await tx
        .update(itineraryDays)
        .set({ dayNumber: -100000 - index })
        .where(eq(itineraryDays.id, row.id));
    for (const day of after.days) {
      if (day.id === "new-day")
        await tx
          .insert(itineraryDays)
          .values({
            tripId: input.tripId,
            dayNumber: day.dayNumber,
            date: day.date,
            location: day.location,
          });
      else
        await tx
          .update(itineraryDays)
          .set({
            dayNumber: day.dayNumber,
            date: day.date,
            location: day.location,
          })
          .where(eq(itineraryDays.id, day.id));
    }
    for (const item of after.activities)
      await tx
        .update(activities)
        .set({
          dayId: item.dayId,
          startTime: item.startTime,
          endTime: item.endTime,
          sortOrder: item.sortOrder,
          archived: item.archived,
          updatedAt: new Date(),
        })
        .where(
          and(eq(activities.id, item.id), eq(activities.tripId, input.tripId)),
        );
    await tx
      .update(restructuringProposals)
      .set({ status: "applied", appliedAt: new Date() })
      .where(eq(restructuringProposals.id, input.proposalId));
    await tx
      .insert(auditEvents)
      .values({
        tripId: input.tripId,
        actorId: user.id,
        action: "itinerary-restructured",
        entityType: "restructuring",
        entityId: input.proposalId,
        details: JSON.stringify(proposal.diff),
      });
  });
  await invalidateTripCache(input.tripId);
  return { proposalId: input.proposalId, status: "applied" };
}

export async function undoRestructuring(input: {
  tripId: string;
  proposalId: string;
}) {
  const { user } = await member(input.tripId);
  if (!db) throw new Error("Database is not configured");
  const proposal = await db.query.restructuringProposals.findFirst({
    where: and(
      eq(restructuringProposals.id, input.proposalId),
      eq(restructuringProposals.tripId, input.tripId),
    ),
  });
  if (!proposal || proposal.status !== "applied")
    throw new Error("Only an applied restructuring can be undone");
  const before = proposal.beforeSnapshot as ScheduleSnapshot;
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ id: itineraryDays.id })
      .from(itineraryDays)
      .where(eq(itineraryDays.tripId, input.tripId));
    const wanted = new Set(before.days.map((day) => day.id));
    for (const row of current)
      if (!wanted.has(row.id))
        await tx.delete(itineraryDays).where(eq(itineraryDays.id, row.id));
    await tx
      .update(trips)
      .set({ endDate: before.trip.endDate, updatedAt: new Date() })
      .where(eq(trips.id, input.tripId));
    for (const day of before.days)
      await tx
        .update(itineraryDays)
        .set({
          dayNumber: day.dayNumber,
          date: day.date,
          location: day.location,
        })
        .where(eq(itineraryDays.id, day.id));
    await tx
      .update(restructuringProposals)
      .set({ status: "undone", undoneAt: new Date() })
      .where(eq(restructuringProposals.id, input.proposalId));
    await tx
      .insert(auditEvents)
      .values({
        tripId: input.tripId,
        actorId: user.id,
        action: "itinerary-restructured-undone",
        entityType: "restructuring",
        entityId: input.proposalId,
        details: JSON.stringify({ restored: true }),
      });
  });
  await invalidateTripCache(input.tripId);
  return { proposalId: input.proposalId, status: "undone" };
}

export async function listRestructuringHistory(tripId: string) {
  await member(tripId);
  if (!db) throw new Error("Database is not configured");
  return db.query.restructuringProposals.findMany({
    where: eq(restructuringProposals.tripId, tripId),
    orderBy: (row, { desc }) => [desc(row.createdAt)],
  });
}
