import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, startSession, validatePassword } from "@/lib/auth";

export async function POST(request: Request) {
  if (!db) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  const body = await request.json() as { name?: string; email?: string; password?: string };
  const name = body.name?.trim(); const email = body.email?.trim().toLowerCase(); const password = body.password ?? "";
  if (!name || !email || !validatePassword(password)) return NextResponse.json({ error: "Use a name, email, and a password with 10+ characters including a number." }, { status: 400 });
  if (await db.query.users.findFirst({ where: eq(users.email, email) })) return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
  const [user] = await db.insert(users).values({ name, email, passwordHash: hashPassword(password) }).returning({ id: users.id });
  await startSession(user.id);
  return NextResponse.json({ ok: true });
}
