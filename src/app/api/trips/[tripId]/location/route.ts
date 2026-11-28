import { NextResponse } from "next/server";
import { saveLatestLocation } from "@/lib/trip-location";

export async function POST(request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const { tripId } = await params;
    const body = await request.json() as { latitude?: number; longitude?: number; accuracyMeters?: number; locality?: string };
    await saveLatestLocation({ tripId, latitude: Number(body.latitude), longitude: Number(body.longitude), accuracyMeters: body.accuracyMeters === undefined ? undefined : Number(body.accuracyMeters), locality: body.locality });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save location." }, { status: 400 });
  }
}
