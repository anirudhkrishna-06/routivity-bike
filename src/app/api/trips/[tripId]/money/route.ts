import { NextResponse } from "next/server";
import { createExpense, editExpense, getMoneyOverview, reverseExpense } from "@/app/actions/money";

export async function GET(_: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try { const { tripId } = await params; return NextResponse.json(await getMoneyOverview(tripId)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load money data." }, { status: 400 }); }
}
export async function POST(request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const { tripId } = await params; const body = await request.json() as { operation?: string; payload: Record<string, unknown> };
    const payload = { ...body.payload, tripId };
    if (body.operation === "create") return NextResponse.json(await createExpense(payload as Parameters<typeof createExpense>[0]));
    if (body.operation === "edit") return NextResponse.json(await editExpense(payload as Parameters<typeof editExpense>[0]));
    if (body.operation === "reverse") return NextResponse.json(await reverseExpense(payload as Parameters<typeof reverseExpense>[0]));
    return NextResponse.json({ error: "Unknown money operation." }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save expense." }, { status: 400 }); }
}
