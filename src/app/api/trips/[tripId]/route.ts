import { NextResponse } from "next/server";
import { deleteTrip } from "@/app/actions/trips";

export async function DELETE(request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try { const { tripId } = await params; const body = await request.json() as { reason?: string }; return NextResponse.json(await deleteTrip(tripId, body.reason || "")); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete trip." }, { status: 400 }); }
}
