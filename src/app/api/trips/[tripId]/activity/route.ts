import { NextResponse } from "next/server";
import { listActivityLog } from "@/app/actions/trips";
export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) { try { const { tripId } = await params; return NextResponse.json({ events: await listActivityLog(tripId) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load activity." }, { status: 400 }); } }
