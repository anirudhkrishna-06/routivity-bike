import { NextResponse } from "next/server";
import { createInvite, createTripJoinCode, listTripMembers } from "@/app/actions/trips";

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) { try { const { tripId } = await params; return NextResponse.json({ members: await listTripMembers(tripId) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load members." }, { status: 401 }); } }
export async function POST(request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try { const { tripId } = await params; const body = await request.json() as { name?: string; email?: string; mode?: string }; if (body.mode === "code") return NextResponse.json(await createTripJoinCode(tripId)); return NextResponse.json(await createInvite({ tripId, name: body.name || "Trip member", email: body.email })); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to invite member." }, { status: 400 }); }
}
