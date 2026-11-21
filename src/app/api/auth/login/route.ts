import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { startSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  if (!db) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const body = await request.json() as { email?: string; password?: string };
  const user = body.email ? await db.query.users.findFirst({ where: eq(users.email, body.email.trim().toLowerCase()) }) : null;
  if (!user || !verifyPassword(body.password ?? "", user.passwordHash)) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  await startSession(user.id);
  return NextResponse.json({ ok: true });
}
