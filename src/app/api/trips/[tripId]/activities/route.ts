import { NextResponse } from "next/server";
import { createActivity, deleteActivity, duplicateActivity, listTripActivities, moveActivity, updateActivity } from "@/app/actions/trips";

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try { const { tripId } = await params; return NextResponse.json({ activities: await listTripActivities(tripId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load itinerary." }, { status: 400 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ tripId: string }> }) { try { const { tripId } = await params; const body = await request.json() as { operation?: string; payload: Record<string, unknown> }; const payload = { ...body.payload, tripId }; if (body.operation === "create") return NextResponse.json(await createActivity(payload as Parameters<typeof createActivity>[0])); if (body.operation === "update") return NextResponse.json(await updateActivity(payload as Parameters<typeof updateActivity>[0])); if (body.operation === "delete") return NextResponse.json(await deleteActivity(payload as Parameters<typeof deleteActivity>[0])); if (body.operation === "duplicate") return NextResponse.json(await duplicateActivity(payload as Parameters<typeof duplicateActivity>[0])); if (body.operation === "move") return NextResponse.json(await moveActivity(payload as Parameters<typeof moveActivity>[0])); return NextResponse.json({ error: "Unknown activity operation." }, { status: 400 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save activity." }, { status: 400 }); } }
