import { NextResponse } from "next/server";
import { getParentTripData } from "@/lib/trip-sharing";

export async function GET(_: Request, { params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const payload = await getParentTripData(shareToken);
  if (!payload) return NextResponse.json({ error: "This private link is unavailable." }, { status: 401 });
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}
