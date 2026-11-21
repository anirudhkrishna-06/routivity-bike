import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { authMagicLinks, users } from "@/lib/db/schema";
import { startSession } from "@/lib/auth";

export async function GET(request: Request) {
  if (!db) return NextResponse.redirect(new URL("/sign-in?error=database", request.url));
  const rawToken = new URL(request.url).searchParams.get("token");
  if (!rawToken) return NextResponse.redirect(new URL("/sign-in?error=invalid-link", request.url));
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const magic = await db.query.authMagicLinks.findFirst({ where: and(eq(authMagicLinks.tokenHash, tokenHash), gt(authMagicLinks.expiresAt, new Date()), isNull(authMagicLinks.usedAt)) });
  if (!magic) return NextResponse.redirect(new URL("/sign-in?error=expired-link", request.url));
  const user = await db.query.users.findFirst({ where: eq(users.email, magic.email) });
  if (!user) return NextResponse.redirect(new URL("/sign-in?error=missing-account", request.url));
  await db.update(authMagicLinks).set({ usedAt: new Date() }).where(eq(authMagicLinks.id, magic.id));
  await startSession(user.id);
  return NextResponse.redirect(new URL("/", request.url));
}
