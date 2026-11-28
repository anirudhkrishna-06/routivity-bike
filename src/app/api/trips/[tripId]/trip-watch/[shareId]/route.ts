import { NextResponse } from "next/server";
import { revokeTripWatchShare } from "@/lib/trip-sharing";

export async function DELETE(_: Request, { params }: { params: Promise<{ tripId: string; shareId: string }> }) {
  try { const value = await params; await revokeTripWatchShare(value.tripId, value.shareId); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to revoke link." }, { status: 400 }); }
}
