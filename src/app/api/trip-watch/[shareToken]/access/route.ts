import { NextResponse } from "next/server";
import { authenticateTripWatch } from "@/lib/trip-sharing";

const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request, { params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${ip}:${shareToken.slice(0, 12)}`;
  const current = attempts.get(key);
  if (current && current.resetAt > Date.now() && current.count >= 8) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429, headers: { "Retry-After": "900" } });
  try {
    const body = await request.json() as { passcode?: string };
    await authenticateTripWatch(shareToken, body.passcode || "");
    attempts.delete(key);
    return NextResponse.json({ ok: true });
  } catch {
    const next = current && current.resetAt > Date.now() ? { count: current.count + 1, resetAt: current.resetAt } : { count: 1, resetAt: Date.now() + 900000 };
    attempts.set(key, next);
    return NextResponse.json({ error: "That passcode or link is not valid." }, { status: 401 });
  }
}
