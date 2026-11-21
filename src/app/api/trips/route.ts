import { NextResponse } from "next/server";
import { createTrip } from "@/app/actions/trips";
export async function POST(request: Request) { try { return NextResponse.json(await createTrip(await request.json())); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create trip." }, { status: 400 }); } }
