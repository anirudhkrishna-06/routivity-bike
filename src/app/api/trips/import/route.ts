import { NextResponse } from "next/server";
import { importTrip } from "@/app/actions/trips";
export async function POST(request: Request) {
  try { return NextResponse.json(await importTrip(await request.json())); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to import trip." }, { status: 400 }); }
}
