import { describe, expect, it } from "vitest";
import { formatMoney } from "./money-format";
import { formatDay } from "./date-format";
import { lateExpenseCount, position, roundTotals } from "./selectors";
describe("settlement selectors", () => {
  it("formats money without a redundant decimal", () => expect(formatMoney(444000)).toBe("₹4,440"));
  it("formats relative days", () => expect(formatDay("2025-11-30", new Date("2025-12-01T12:00:00"))).toBe("Yesterday"));
  it("derives viewer position and late expenses", () => { const people = [{ participantId: "me", name: "Me", netPaise: 444000, paidPaise: 0, sharePaise: 0 }, { participantId: "a", name: "A", netPaise: -444000, paidPaise: 0, sharePaise: 0 }]; const round = { id: "r", status: "open", createdAt: "2025-11-20T00:00:00Z", snapshot: people.map(({ participantId, netPaise }) => ({ participantId, netPaise })) }; expect(position(people, "me").net).toBe(444000); expect(lateExpenseCount([{ id: "e", description: null, category: "FOOD", expenseDate: "2025-11-21", amountPaise: 100, reversedAt: null, createdAt: "2025-11-21T00:00:00Z", payments: [], shares: [] }], round)).toBe(1); expect(roundTotals(round, [{ id: "t", roundId: "r", senderId: "a", receiverId: "me", amountPaise: 100, status: "confirmed" }])).toMatchObject({ settled: 100, total: 444000 }); });
});
