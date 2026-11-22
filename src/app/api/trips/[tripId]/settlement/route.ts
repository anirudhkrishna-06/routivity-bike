import { NextResponse } from "next/server";
import {
  closeSettlementRound,
  confirmSettlementTransfer,
  getMoneyOverview,
  recordSettlementTransfer,
  reverseSettlementTransfer,
  settlePendingSettlementTransfer,
  settleSettlementTransfer,
  startSettlementRound,
} from "@/app/actions/money";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const data = await getMoneyOverview(tripId);
    return NextResponse.json({
      balances: data.balances,
      suggestions: data.suggestions,
      rounds: data.rounds,
      transfers: data.transfers,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load settlements.",
      },
      { status: 400 },
    );
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await params;
    const body = (await request.json()) as {
      operation?: string;
      payload: Record<string, unknown>;
    };
    const payload = { ...body.payload, tripId };
    if (body.operation === "start")
      return NextResponse.json(
        await startSettlementRound(
          payload as Parameters<typeof startSettlementRound>[0],
        ),
      );
    if (body.operation === "settle")
      return NextResponse.json(
        await settleSettlementTransfer(
          payload as Parameters<typeof settleSettlementTransfer>[0],
        ),
      );
    if (body.operation === "settle-pending")
      return NextResponse.json(
        await settlePendingSettlementTransfer(
          payload as Parameters<typeof settlePendingSettlementTransfer>[0],
        ),
      );
    if (body.operation === "record")
      return NextResponse.json(
        await recordSettlementTransfer(
          payload as Parameters<typeof recordSettlementTransfer>[0],
        ),
      );
    if (body.operation === "confirm")
      return NextResponse.json(
        await confirmSettlementTransfer(
          payload as Parameters<typeof confirmSettlementTransfer>[0],
        ),
      );
    if (body.operation === "reverse")
      return NextResponse.json(
        await reverseSettlementTransfer(
          payload as Parameters<typeof reverseSettlementTransfer>[0],
        ),
      );
    if (body.operation === "close")
      return NextResponse.json(
        await closeSettlementRound(
          payload as Parameters<typeof closeSettlementRound>[0],
        ),
      );
    return NextResponse.json(
      { error: "Unknown settlement operation." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save settlement.",
      },
      { status: 400 },
    );
  }
}
