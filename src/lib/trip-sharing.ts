import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { assertTripMember } from "@/lib/access";
import { db } from "@/lib/db";
import { activities, itineraryDays, participants, tripMemberLocations, tripWatchSessions, tripWatchShares, trips } from "@/lib/db/schema";

export const TRIP_WATCH_COOKIE = "routivity_trip_watch";
const SESSION_HOURS = 24;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export type ParentActivity = {
  date: string; dayNumber: number; type: string; title: string; startTime: string | null;
  endTime: string | null; origin: string | null; destination: string | null; location: string | null;
  mapsUrl: string | null; viaPoints: string | null; distanceKmMilli: number | null; notes: string | null;
  travelMode: string | null; stayNights: number | null; commitment: string; status: string;
};

export async function createTripWatchShare(input: { tripId: string; passcode: string; recipientLabel?: string; expiresAt?: string }) {
  const user = await getCurrentUser();
  if (!user || !db) throw new Error("Authentication required");
  const member = await db.query.participants.findFirst({ where: and(eq(participants.tripId, input.tripId), eq(participants.userId, user.id), eq(participants.status, "active")) });
  assertTripMember(member ? { tripId: input.tripId, userId: user.id, status: member.status, role: member.role } : null, input.tripId);
  if (input.passcode.length < 10 || !/[A-Za-z]/.test(input.passcode) || !/\d/.test(input.passcode)) throw new Error("Use at least 10 characters with a letter and a number.");
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) throw new Error("Choose a future expiration date.");
  const [share] = await db.insert(tripWatchShares).values({ tripId: input.tripId, tokenHash: hash(rawToken), passcodeHash: hashPassword(input.passcode), recipientLabel: input.recipientLabel?.trim().slice(0, 80) || null, expiresAt, createdBy: user.id }).returning({ id: tripWatchShares.id, expiresAt: tripWatchShares.expiresAt, createdAt: tripWatchShares.createdAt });
  return { url: `/trip-watch/${rawToken}`, expiresAt: share.expiresAt?.toISOString() || null, createdAt: share.createdAt.toISOString() };
}

export async function listTripWatchShares(tripId: string) {
  const user = await getCurrentUser();
  if (!user || !db) throw new Error("Authentication required");
  const member = await db.query.participants.findFirst({ where: and(eq(participants.tripId, tripId), eq(participants.userId, user.id), eq(participants.status, "active")) });
  assertTripMember(member ? { tripId, userId: user.id, status: member.status, role: member.role } : null, tripId);
  return db.select({ id: tripWatchShares.id, recipientLabel: tripWatchShares.recipientLabel, expiresAt: tripWatchShares.expiresAt, active: tripWatchShares.active, lastAccessedAt: tripWatchShares.lastAccessedAt, createdAt: tripWatchShares.createdAt }).from(tripWatchShares).where(eq(tripWatchShares.tripId, tripId));
}

export async function revokeTripWatchShare(tripId: string, shareId: string) {
  const user = await getCurrentUser();
  if (!user || !db) throw new Error("Authentication required");
  const member = await db.query.participants.findFirst({ where: and(eq(participants.tripId, tripId), eq(participants.userId, user.id), eq(participants.status, "active")) });
  assertTripMember(member ? { tripId, userId: user.id, status: member.status, role: member.role } : null, tripId);
  await db.update(tripWatchShares).set({ active: false }).where(and(eq(tripWatchShares.id, shareId), eq(tripWatchShares.tripId, tripId)));
  await db.delete(tripWatchSessions).where(eq(tripWatchSessions.shareId, shareId));
}

export async function authenticateTripWatch(rawToken: string, passcode: string) {
  if (!db) throw new Error("Database is not configured");
  const share = await db.query.tripWatchShares.findFirst({ where: and(eq(tripWatchShares.tokenHash, hash(rawToken)), eq(tripWatchShares.active, true), or(isNull(tripWatchShares.expiresAt), gt(tripWatchShares.expiresAt, new Date()))) });
  if (!share || !verifyPassword(passcode, share.passcodeHash)) throw new Error("That passcode or link is not valid.");
  const rawSession = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600000);
  await db.insert(tripWatchSessions).values({ shareId: share.id, sessionHash: hash(rawSession), expiresAt });
  await db.update(tripWatchShares).set({ lastAccessedAt: new Date() }).where(eq(tripWatchShares.id, share.id));
  (await cookies()).set(TRIP_WATCH_COOKIE, rawSession, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_HOURS * 3600 });
}

async function getViewerShare(rawToken: string) {
  if (!db) return null;
  const sessionToken = (await cookies()).get(TRIP_WATCH_COOKIE)?.value;
  if (!sessionToken) return null;
  const rows = await db.select({ share: tripWatchShares }).from(tripWatchSessions).innerJoin(tripWatchShares, eq(tripWatchShares.id, tripWatchSessions.shareId)).where(and(eq(tripWatchSessions.sessionHash, hash(sessionToken)), eq(tripWatchShares.tokenHash, hash(rawToken)), eq(tripWatchShares.active, true), gt(tripWatchSessions.expiresAt, new Date()), or(isNull(tripWatchShares.expiresAt), gt(tripWatchShares.expiresAt, new Date())))).limit(1);
  return rows[0]?.share ?? null;
}

export async function getParentTripData(rawToken: string) {
  const share = await getViewerShare(rawToken);
  if (!share || !db) return null;
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, share.tripId) });
  if (!trip) return null;
  const [days, rows, location] = await Promise.all([
    db.select({ dayNumber: itineraryDays.dayNumber, date: itineraryDays.date, location: itineraryDays.location }).from(itineraryDays).where(eq(itineraryDays.tripId, trip.id)).orderBy(itineraryDays.dayNumber),
    db.select({ date: itineraryDays.date, dayNumber: itineraryDays.dayNumber, type: activities.type, title: activities.title, startTime: activities.startTime, endTime: activities.endTime, origin: activities.origin, destination: activities.destination, location: activities.location, mapsUrl: activities.mapsUrl, viaPoints: activities.viaPoints, distanceKmMilli: activities.distanceKmMilli, notes: activities.notes, travelMode: activities.travelMode, stayNights: activities.stayNights, commitment: activities.commitment, status: activities.status }).from(activities).innerJoin(itineraryDays, eq(activities.dayId, itineraryDays.id)).where(and(eq(activities.tripId, trip.id), eq(activities.archived, false))).orderBy(itineraryDays.dayNumber, activities.sortOrder),
    db.select({ latitude: tripMemberLocations.latitude, longitude: tripMemberLocations.longitude, accuracyMeters: tripMemberLocations.accuracyMeters, recordedAt: tripMemberLocations.recordedAt, locality: tripMemberLocations.locality }).from(tripMemberLocations).innerJoin(participants, eq(participants.id, tripMemberLocations.participantId)).where(and(eq(participants.tripId, trip.id), eq(participants.status, "active"))).orderBy(tripMemberLocations.recordedAt),
  ]);
  const latest = location.at(-1);
  return { trip: { name: trip.name, startDate: trip.startDate, endDate: trip.endDate, timezone: trip.timezone }, days, activities: rows as ParentActivity[], location: latest ?? null, share: { recipientLabel: share.recipientLabel, expiresAt: share.expiresAt } };
}
