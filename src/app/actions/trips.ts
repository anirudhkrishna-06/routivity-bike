"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { assertTripMember } from "@/lib/access";
import { db } from "@/lib/db";
import { activities, auditEvents, budgetRuleHistory, budgetRules, expensePayments, expenseRevisions, expenseShares, expenses, invitations, itineraryDays, mutations, participants, settlementRounds, settlementTransfers, trips, users, bikes } from "@/lib/db/schema";
import { invalidateTripCache } from "@/lib/cache";
import { buildMapsUrl } from "@/lib/maps";

type ActivityInput = { type: "TRAVEL" | "STAY" | "EXPLORATION" | "CUSTOM"; title: string; date: string; startTime?: string; endTime?: string; origin?: string; destination?: string; location?: string; viaPoints?: string; mapsUrl?: string; distanceKmMilli?: number; bikeId?: string; status?: "planned" | "done" | "skipped"; movable?: boolean };
type BudgetInput = { category: string; ruleType: "PER_DAY" | "PER_NIGHT" | "TOTAL" | "DERIVED"; amountPaise: number; effectiveFrom?: string };
type Db = NonNullable<typeof db>;
type Tx = Pick<Db, "select" | "insert" | "update">;

function tokenHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function actor() { const user = await getCurrentUser(); if (!user) throw new Error("Authentication required"); return user; }
async function member(tripId: string, ownerOnly = false) {
  const user = await actor(); if (!db) throw new Error("Database is not configured");
  const membership = await db.query.participants.findFirst({ where: and(eq(participants.tripId, tripId), eq(participants.userId, user.id), eq(participants.status, "active")) });
  assertTripMember(membership ? { tripId, userId: user.id, status: membership.status, role: membership.role } : null, tripId);
  if (ownerOnly && membership?.role !== "owner") throw new Error("Owner access required");
  return { user, membership };
}
function datesBetween(start: string, end: string) {
  const dates: string[] = [];
  for (let cursor = new Date(start + "T00:00:00Z"), last = new Date(end + "T00:00:00Z"); cursor <= last; cursor.setUTCDate(cursor.getUTCDate() + 1)) dates.push(cursor.toISOString().slice(0, 10));
  return dates;
}
function overlaps(aStart?: string | null, aEnd?: string | null, bStart?: string | null, bEnd?: string | null) {
  return Boolean(aStart && aEnd && bStart && bEnd && aStart < bEnd && bStart < aEnd);
}
async function ensureNoOverlap(tx: Tx, tripId: string, dayId: string, startTime?: string | null, endTime?: string | null, exceptId?: string) {
  const existing = await tx.select().from(activities).where(and(eq(activities.tripId, tripId), eq(activities.dayId, dayId), eq(activities.archived, false)));
  const conflict = existing.find((item) => item.id !== exceptId && overlaps(startTime, endTime, item.startTime, item.endTime));
  if (conflict) throw new Error("OVERLAP:" + conflict.id + ":" + conflict.title);
}
async function audit(tx: Tx, tripId: string, actorId: string, action: string, entityId: string, details: unknown) {
  await tx.insert(auditEvents).values({ tripId, actorId, action, entityType: "itinerary", entityId, details: JSON.stringify(details) });
}
async function participantRows(tx: Tx, tripId: string, members: { name: string; email?: string }[], owner: { name: string; email: string; id: string }, ownerMemberName?: string) {
  const selectedName = ownerMemberName?.trim().toLowerCase();
  const selectedIndex = members.findIndex((item) => selectedName && item.name.trim().toLowerCase() === selectedName);
  const ownerInMembers = selectedIndex >= 0 || members.some((item) => item.email?.trim().toLowerCase() === owner.email.toLowerCase());
  const rows: { tripId: string; name: string; email?: string; userId: string | null; role: "owner" | "member" }[] = [];
  for (const item of members) {
    const email = item.email?.trim().toLowerCase();
    const isOwnerMember = (selectedName && item.name.trim().toLowerCase() === selectedName) || (email && email === owner.email.toLowerCase()) || (!ownerMemberName && item.name.trim().toLowerCase() === owner.name.trim().toLowerCase());
    const linked = email ? await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1) : [];
    rows.push({ tripId, name: item.name.trim(), email, userId: isOwnerMember ? owner.id : linked[0]?.id ?? null, role: isOwnerMember ? "owner" : "member" });
  }
  if (!ownerInMembers) rows.unshift({ tripId, name: owner.name, email: owner.email, userId: owner.id, role: "owner" });
  return rows;
}

export async function createTrip(input: { name: string; startDate: string; endDate: string; timezone: string; currency?: string; members?: { name: string; email?: string }[] }) {
  const user = await actor(); if (!db) throw new Error("Database is not configured");
  if (!input.name.trim() || input.startDate > input.endDate) throw new Error("Trip name and valid dates are required");
  const result = await db.transaction(async (tx) => {
    const [trip] = await tx.insert(trips).values({ name: input.name.trim(), startDate: input.startDate, endDate: input.endDate, timezone: input.timezone, currency: input.currency || "INR", createdBy: user.id }).returning();
    const days = await tx.insert(itineraryDays).values(datesBetween(input.startDate, input.endDate).map((date, index) => ({ tripId: trip.id, dayNumber: index + 1, date }))).returning();
    const members = await participantRows(tx, trip.id, input.members || [], user);
    await tx.insert(participants).values(members);
    await audit(tx, trip.id, user.id, "created", trip.id, { days: days.length, members: members.length });
    return trip;
  });
  await invalidateTripCache(result.id); return result;
}

export async function createInvite(input: { tripId: string; name: string; email?: string }) {
  const { user } = await member(input.tripId, true); if (!db) throw new Error("Database is not configured");
  const [participant] = await db.insert(participants).values({ tripId: input.tripId, name: input.name.trim(), email: input.email?.trim().toLowerCase() }).returning();
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.insert(invitations).values({ tripId: input.tripId, participantId: participant.id, tokenHash: tokenHash(rawToken), expiresAt });
  await db.insert(auditEvents).values({ tripId: input.tripId, actorId: user.id, action: "invited", entityType: "participant", entityId: participant.id, details: JSON.stringify({ email: input.email }) });
  return { inviteUrl: "/invite/" + rawToken, expiresAt: expiresAt.toISOString() };
}

export async function listTripMembers(tripId: string) {
  await member(tripId); if (!db) throw new Error("Database is not configured");
  return db.query.participants.findMany({ where: eq(participants.tripId, tripId) });
}

export async function listTripActivities(tripId: string) {
  await member(tripId); if (!db) throw new Error("Database is not configured");
  return db.select({
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
    mapsUrl: activities.mapsUrl,
    distanceKmMilli: activities.distanceKmMilli,
    bikeId: activities.bikeId,
    status: activities.status,
    sortOrder: activities.sortOrder,
  }).from(activities).innerJoin(itineraryDays, eq(activities.dayId, itineraryDays.id)).where(and(eq(activities.tripId, tripId), eq(activities.archived, false))).orderBy(asc(activities.sortOrder));
}

export async function acceptInvite(rawToken: string) {
  const user = await actor(); if (!db) throw new Error("Database is not configured");
  const invitation = await db.query.invitations.findFirst({ where: and(eq(invitations.tokenHash, tokenHash(rawToken)), gte(invitations.expiresAt, new Date())) });
  if (!invitation || invitation.acceptedAt) throw new Error("This invite is invalid or expired");
  await db.transaction(async (tx) => {
    await tx.update(participants).set({ userId: user.id, email: user.email, name: user.name }).where(eq(participants.id, invitation.participantId));
    await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, invitation.id));
    await audit(tx, invitation.tripId, user.id, "joined", invitation.participantId, {});
  });
  return { tripId: invitation.tripId };
}

export async function importTrip(input: { idempotencyKey: string; trip: { name: string; startDate: string; endDate: string; timezone: string; currency?: string }; members: { name: string; email?: string }[]; authMemberName?: string; activities: ActivityInput[]; budgets?: BudgetInput[] }) {
  const user = await actor(); if (!db) throw new Error("Database is not configured");
  const existing = await db.query.mutations.findFirst({ where: eq(mutations.idempotencyKey, input.idempotencyKey) });
  if (existing) return JSON.parse(existing.result) as { tripId: string };
  const result = await db.transaction(async (tx) => {
    const [trip] = await tx.insert(trips).values({ name: input.trip.name, startDate: input.trip.startDate, endDate: input.trip.endDate, timezone: input.trip.timezone, currency: input.trip.currency || "INR", createdBy: user.id }).returning();
    const days = await tx.insert(itineraryDays).values(datesBetween(input.trip.startDate, input.trip.endDate).map((date, index) => ({ tripId: trip.id, dayNumber: index + 1, date }))).returning();
    await tx.insert(participants).values(await participantRows(tx, trip.id, input.members, user, input.authMemberName));
    if (input.budgets?.length) await tx.insert(budgetRules).values(input.budgets.map((rule) => ({ tripId: trip.id, category: rule.category, ruleType: rule.ruleType, amountPaise: rule.amountPaise, effectiveFrom: rule.effectiveFrom || trip.startDate, createdBy: user.id })));
    for (const [index, item] of input.activities.entries()) {
      const day = days.find((candidate) => candidate.date === item.date) || days[0];
      if (!day) throw new Error("Trip must contain at least one day");
      await ensureNoOverlap(tx, trip.id, day.id, item.startTime, item.endTime);
      await tx.insert(activities).values({ tripId: trip.id, dayId: day.id, type: item.type, title: item.title, startTime: item.startTime, endTime: item.endTime, origin: item.origin, destination: item.destination, location: item.location, viaPoints: item.viaPoints, mapsUrl: buildMapsUrl(item), distanceKmMilli: item.distanceKmMilli, bikeId: item.bikeId, status: item.status || "planned", movable: item.movable ?? true, sortOrder: index });
    }
    const payload = { tripId: trip.id };
    await audit(tx, trip.id, user.id, "imported", trip.id, { activities: input.activities.length, budgets: input.budgets?.length || 0 });
    await tx.insert(mutations).values({ idempotencyKey: input.idempotencyKey, tripId: trip.id, actorId: user.id, result: JSON.stringify(payload) });
    return payload;
  });
  await invalidateTripCache(result.tripId); return result;
}

export async function createActivity(input: { tripId: string; idempotencyKey: string; activity: ActivityInput }) {
  const { user } = await member(input.tripId); if (!db) throw new Error("Database is not configured");
  const day = await db.query.itineraryDays.findFirst({ where: and(eq(itineraryDays.tripId, input.tripId), eq(itineraryDays.date, input.activity.date)) });
  if (!day) throw new Error("Activity date is outside the trip");
  const result = await db.transaction(async (tx) => {
    await ensureNoOverlap(tx, input.tripId, day.id, input.activity.startTime, input.activity.endTime);
    const [created] = await tx.insert(activities).values({ tripId: input.tripId, dayId: day.id, type: input.activity.type, title: input.activity.title, startTime: input.activity.startTime, endTime: input.activity.endTime, origin: input.activity.origin, destination: input.activity.destination, location: input.activity.location, viaPoints: input.activity.viaPoints, mapsUrl: buildMapsUrl(input.activity), status: input.activity.status || "planned", movable: input.activity.movable ?? true }).returning();
    await audit(tx, input.tripId, user.id, "created", created.id, input.activity); return created;
  });
  await invalidateTripCache(input.tripId); return result;
}

export async function updateActivity(input: { tripId: string; activityId: string; change: Partial<ActivityInput>; idempotencyKey: string }) {
  const { user } = await member(input.tripId); if (!db) throw new Error("Database is not configured");
  const current = await db.query.activities.findFirst({ where: and(eq(activities.id, input.activityId), eq(activities.tripId, input.tripId), eq(activities.archived, false)) });
  if (!current) throw new Error("Activity not found");
  const day = input.change.date ? await db.query.itineraryDays.findFirst({ where: and(eq(itineraryDays.tripId, input.tripId), eq(itineraryDays.date, input.change.date)) }) : await db.query.itineraryDays.findFirst({ where: eq(itineraryDays.id, current.dayId) });
  if (!day) throw new Error("Activity date is outside the trip");
  const result = await db.transaction(async (tx) => {
    await ensureNoOverlap(tx, input.tripId, day.id, input.change.startTime ?? current.startTime, input.change.endTime ?? current.endTime, input.activityId);
    const [updated] = await tx.update(activities).set({ dayId: day.id, title: input.change.title ?? current.title, type: input.change.type ?? current.type, startTime: input.change.startTime ?? current.startTime, endTime: input.change.endTime ?? current.endTime, origin: input.change.origin ?? current.origin, destination: input.change.destination ?? current.destination, location: input.change.location ?? current.location, viaPoints: input.change.viaPoints ?? current.viaPoints, mapsUrl: buildMapsUrl({ ...current, ...input.change, mapsUrl: current.mapsUrl ?? undefined, origin: current.origin ?? undefined, destination: current.destination ?? undefined, location: current.location ?? undefined, viaPoints: current.viaPoints ?? undefined, type: input.change.type ?? current.type }), status: input.change.status ?? current.status, movable: input.change.movable ?? current.movable, updatedAt: new Date() }).where(eq(activities.id, input.activityId)).returning();
    await audit(tx, input.tripId, user.id, "updated", input.activityId, input.change); return updated;
  });
  await invalidateTripCache(input.tripId); return result;
}

export async function deleteActivity(input: { tripId: string; activityId: string; resolution?: { mode: "unlink" | "reassign"; targetActivityId?: string }; idempotencyKey: string }) {
  const { user } = await member(input.tripId); if (!db) throw new Error("Database is not configured");
  const linked = await db.query.expenses.findMany({ where: and(eq(expenses.tripId, input.tripId), eq(expenses.activityId, input.activityId)) });
  if (linked.length && !input.resolution) throw new Error("EXPENSE_LINKED:" + linked.length);
  if (input.resolution?.mode === "reassign" && !input.resolution.targetActivityId) throw new Error("Choose another activity for linked expenses");
  const result = await db.transaction(async (tx) => {
    if (linked.length && input.resolution?.mode === "unlink") await tx.update(expenses).set({ activityId: null }).where(eq(expenses.activityId, input.activityId));
    if (linked.length && input.resolution?.mode === "reassign") await tx.update(expenses).set({ activityId: input.resolution.targetActivityId }).where(eq(expenses.activityId, input.activityId));
    await tx.update(activities).set({ archived: true, updatedAt: new Date() }).where(eq(activities.id, input.activityId));
    await audit(tx, input.tripId, user.id, "deleted", input.activityId, input.resolution || {});
    return { activityId: input.activityId };
  });
  await invalidateTripCache(input.tripId); return result;
}

export async function duplicateActivity(input: { tripId: string; activityId: string; idempotencyKey: string }) {
  const { user } = await member(input.tripId); if (!db) throw new Error("Database is not configured");
  const current = await db.query.activities.findFirst({ where: and(eq(activities.id, input.activityId), eq(activities.tripId, input.tripId), eq(activities.archived, false)) });
  if (!current) throw new Error("Activity not found");
  const result = await db.transaction(async (tx) => {
    await ensureNoOverlap(tx, input.tripId, current.dayId, current.startTime, current.endTime);
    const [copy] = await tx.insert(activities).values({ tripId: current.tripId, dayId: current.dayId, type: current.type, title: current.title + " (copy)", startTime: current.startTime, endTime: current.endTime, origin: current.origin, destination: current.destination, location: current.location, mapsUrl: current.mapsUrl, viaPoints: current.viaPoints, bikeId: current.bikeId, status: "planned", movable: current.movable, sortOrder: current.sortOrder + 1 }).returning();
    await audit(tx, input.tripId, user.id, "duplicated", copy.id, { source: input.activityId }); return copy;
  });
  await invalidateTripCache(input.tripId); return result;
}

export async function moveActivity(input: { tripId: string; activityId: string; date: string; idempotencyKey: string }) {
  const current = await db?.query.activities.findFirst({ where: and(eq(activities.id, input.activityId), eq(activities.tripId, input.tripId)) });
  if (!current) throw new Error("Activity not found");
  return updateActivity({ tripId: input.tripId, activityId: input.activityId, idempotencyKey: input.idempotencyKey, change: { date: input.date, startTime: current.startTime ?? undefined, endTime: current.endTime ?? undefined } });
}

export async function listActivityLog(tripId: string) {
  await member(tripId); if (!db) throw new Error("Database is not configured");
  return db.query.auditEvents.findMany({ where: eq(auditEvents.tripId, tripId), orderBy: (events, { desc }) => [desc(events.createdAt)], limit: 100 });
}

export async function deleteTrip(tripId: string, reason: string) {
  const { user } = await member(tripId, true);
  if (!reason.trim()) throw new Error("A deletion reason is required");
  await db!.transaction(async (tx) => {
    const expenseIds = (await tx.select({ id: expenses.id }).from(expenses).where(eq(expenses.tripId, tripId))).map((row) => row.id);
    const ruleIds = (await tx.select({ id: budgetRules.id }).from(budgetRules).where(eq(budgetRules.tripId, tripId))).map((row) => row.id);
    const roundIds = (await tx.select({ id: settlementRounds.id }).from(settlementRounds).where(eq(settlementRounds.tripId, tripId))).map((row) => row.id);
    if (expenseIds.length) { await tx.delete(expensePayments).where(inArray(expensePayments.expenseId, expenseIds)); await tx.delete(expenseShares).where(inArray(expenseShares.expenseId, expenseIds)); await tx.delete(expenseRevisions).where(inArray(expenseRevisions.expenseId, expenseIds)); }
    if (ruleIds.length) await tx.delete(budgetRuleHistory).where(inArray(budgetRuleHistory.budgetRuleId, ruleIds));
    if (roundIds.length) await tx.delete(settlementTransfers).where(inArray(settlementTransfers.roundId, roundIds));
    await tx.delete(settlementTransfers).where(eq(settlementTransfers.tripId, tripId));
    await tx.delete(settlementRounds).where(eq(settlementRounds.tripId, tripId));
    await tx.delete(budgetRules).where(eq(budgetRules.tripId, tripId));
    await tx.delete(expenses).where(eq(expenses.tripId, tripId));
    await tx.delete(mutations).where(eq(mutations.tripId, tripId));
    await tx.delete(auditEvents).where(eq(auditEvents.tripId, tripId));
    await tx.delete(invitations).where(eq(invitations.tripId, tripId));
    await tx.delete(activities).where(eq(activities.tripId, tripId));
    await tx.delete(bikes).where(eq(bikes.tripId, tripId));
    await tx.delete(itineraryDays).where(eq(itineraryDays.tripId, tripId));
    await tx.delete(participants).where(eq(participants.tripId, tripId));
    await tx.delete(trips).where(eq(trips.id, tripId));
  });
  await invalidateTripCache(tripId);
  return { tripId, deletedBy: user.id };
}
