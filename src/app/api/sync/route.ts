import { NextResponse } from "next/server";
import { createActivity, deleteActivity, duplicateActivity, importTrip, moveActivity, updateActivity } from "@/app/actions/trips";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { type: string; payload: Record<string, unknown> };
    if (body.type === "import-itinerary") return NextResponse.json(await importTrip(body.payload as Parameters<typeof importTrip>[0]));
    if (body.type === "create-activity") return NextResponse.json(await createActivity(body.payload as Parameters<typeof createActivity>[0]));
    if (body.type === "update-activity") return NextResponse.json(await updateActivity(body.payload as Parameters<typeof updateActivity>[0]));
    if (body.type === "delete-activity") return NextResponse.json(await deleteActivity(body.payload as Parameters<typeof deleteActivity>[0]));
    if (body.type === "duplicate-activity") return NextResponse.json(await duplicateActivity(body.payload as Parameters<typeof duplicateActivity>[0]));
    if (body.type === "move-activity") return NextResponse.json(await moveActivity(body.payload as Parameters<typeof moveActivity>[0]));
    return NextResponse.json({ error: "Unknown mutation type." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sync failed." }, { status: 400 });
  }
}
