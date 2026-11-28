import { NextResponse } from "next/server";
import { createTripWatchShare, listTripWatchShares } from "@/lib/trip-sharing";

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try { return NextResponse.json({ shares: await listTripWatchShares((await params).tripId) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load sharing links." }, { status: 403 }); }
}

export async function POST(request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const body = await request.json() as { passcode?: string; recipientLabel?: string; expiresAt?: string };
    return NextResponse.json(await createTripWatchShare({ tripId: (await params).tripId, passcode: body.passcode || "", recipientLabel: body.recipientLabel, expiresAt: body.expiresAt }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create sharing link." }, { status: 400 }); }
}
