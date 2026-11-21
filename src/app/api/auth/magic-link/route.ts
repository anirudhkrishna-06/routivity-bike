import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authMagicLinks, users } from "@/lib/db/schema";

export async function POST(request: Request) {
  if (!db) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const body = await request.json() as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
  let user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) [user] = await db.insert(users).values({ email, name: email.split("@")[0] }).returning();
  const rawToken = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(authMagicLinks).values({ email, tokenHash: createHash("sha256").update(rawToken).digest("hex"), expiresAt });
  const link = new URL("/api/auth/magic-link/verify?token=" + rawToken, process.env.BETTER_AUTH_URL || "http://localhost:3000").toString();
  if (process.env.MAGIC_LINK_WEBHOOK_URL) await fetch(process.env.MAGIC_LINK_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, link, expiresAt }) });
  return NextResponse.json({ ok: true, ...(process.env.NODE_ENV !== "production" ? { developmentLink: link } : {}) });
}
