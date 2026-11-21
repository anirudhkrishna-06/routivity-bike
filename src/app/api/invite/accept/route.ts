import { NextResponse } from "next/server";
import { acceptInvite } from "@/app/actions/trips";
export async function POST(request: Request) { try { const body = await request.json() as { token?: string }; if (!body.token) return NextResponse.json({ error: "Invite token is required." }, { status: 400 }); return NextResponse.json(await acceptInvite(body.token)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to accept invite." }, { status: 400 }); } }
