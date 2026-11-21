import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { authSessions, users } from "@/lib/db/schema";

const COOKIE = "routivity_session";
const SESSION_DAYS = 30;

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
export async function startSession(userId: string) {
  if (!db) throw new Error("Database is not configured");
  const token = randomBytes(32).toString("base64url");
  await db.insert(authSessions).values({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000) });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
}
export async function getCurrentUser() {
  if (!db) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db.select({ user: users, session: authSessions }).from(authSessions).innerJoin(users, eq(users.id, authSessions.userId)).where(and(eq(authSessions.tokenHash, hashToken(token)), gt(authSessions.expiresAt, new Date()))).limit(1);
  return rows[0]?.user ?? null;
}
export async function endSession() {
  if (db) {
    const token = (await cookies()).get(COOKIE)?.value;
    if (token) await db.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(token)));
  }
  (await cookies()).delete(COOKIE);
}
export function validatePassword(password: string) {
  return password.length >= 10 && /[A-Za-z]/.test(password) && /\d/.test(password);
}
