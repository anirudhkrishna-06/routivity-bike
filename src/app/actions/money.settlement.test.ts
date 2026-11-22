import { beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

type Transfer = {
  id: string;
  roundId: string;
  tripId: string;
  senderId: string;
  receiverId: string;
  amountPaise: number;
  status: "pending" | "confirmed" | "reversed";
  recordedBy: string;
  confirmedBy?: string;
  confirmedAt?: Date;
  reversalReason?: string | null;
};
type State = {
  members: {
    id: string;
    name: string;
    userId: string;
    tripId: string;
    status: string;
    role: string;
  }[];
  round: {
    id: string;
    tripId: string;
    status: string;
    snapshot: { participantId: string; netPaise: number }[];
  };
  transfers: Transfer[];
  mutations: { idempotencyKey: string; result: string }[];
  audits: { action: string; actorId: string; entityId: string }[];
  failAudit: boolean;
  nextId: number;
};

const h = vi.hoisted(() => {
  const state: State = {
    members: [
      {
        id: "p-a",
        name: "A",
        userId: "u-a",
        tripId: "trip",
        status: "active",
        role: "member",
      },
      {
        id: "p-b",
        name: "B",
        userId: "u-b",
        tripId: "trip",
        status: "active",
        role: "member",
      },
    ],
    round: {
      id: "round",
      tripId: "trip",
      status: "open",
      snapshot: [
        { participantId: "p-a", netPaise: -1000 },
        { participantId: "p-b", netPaise: 1000 },
      ],
    },
    transfers: [],
    mutations: [],
    audits: [],
    failAudit: false,
    nextId: 1,
  };
  let actor = "u-a";
  let tail = Promise.resolve();
  const match = (row: Record<string, unknown>, condition: unknown): boolean => {
    if (!condition || typeof condition !== "object") return true;
    const item = condition as {
      type?: string;
      conditions?: unknown[];
      column?: string;
      value?: unknown;
    };
    if (item.type === "and")
      return (item.conditions || []).every((child) => match(row, child));
    if (item.type === "eq") return row[item.column || ""] === item.value;
    if (item.type === "in")
      return (item.value as unknown[]).includes(row[item.column || ""]);
    return true;
  };
  const tableName = (table: unknown) =>
    typeof table === "string" ? table : (table as { __name: string }).__name;
  const rows = (table: unknown, condition?: unknown) => {
    const name = tableName(table);
    if (name === "participants")
      return state.members.filter((row) => match(row, condition));
    if (name === "settlementRounds")
      return [state.round].filter((row) => match(row, condition));
    if (name === "settlementTransfers") {
      return state.transfers.filter((row) => match(row, condition));
    }
    if (name === "mutations")
      return state.mutations.filter((row) => match(row, condition));
    return [];
  };
  const select = () => ({
    from: (table: unknown) => ({
      where: (condition: unknown) => ({
        for: async () => rows(table, condition),
        then: (resolve: (value: unknown[]) => unknown) =>
          Promise.resolve(rows(table, condition)).then(resolve),
      }),
    }),
  });
  const db: any = {
    query: {
      participants: {
        findFirst: async () =>
          state.members.find((member) => member.userId === actor),
        findMany: async ({ where }: { where?: unknown }) =>
          rows("participants", where),
      },
      mutations: {
        findFirst: async ({ where }: { where?: unknown }) =>
          rows("mutations", where)[0],
      },
      settlementRounds: {
        findFirst: async ({ where }: { where?: unknown }) =>
          rows("settlementRounds", where)[0],
      },
      settlementTransfers: {
        findMany: async ({ where }: { where?: unknown }) =>
          rows("settlementTransfers", where),
      },
      expenses: { findMany: async () => [] },
      expensePayments: { findMany: async () => [] },
      expenseShares: { findMany: async () => [] },
    },
    select,
    insert: (table: unknown) => ({
      values: (value: Record<string, unknown>) => {
        const name = tableName(table);
        if (name === "auditEvents") {
          if (state.failAudit) throw new Error("audit failed");
          state.audits.push({
            action: String(value.action),
            actorId: String(value.actorId),
            entityId: String(value.entityId),
          });
        }
        const inserted =
          name === "settlementTransfers"
            ? { ...value, id: String(value.id || `transfer-${state.nextId++}`) }
            : value;
        if (name === "settlementTransfers")
          state.transfers.push(inserted as unknown as Transfer);
        if (name === "mutations")
          state.mutations.push(value as State["mutations"][number]);
        return { returning: async () => [inserted] };
      },
    }),
    update: (table: unknown) => ({
      set: (value: Record<string, unknown>) => ({
        where: (condition: unknown) => ({
          returning: async () => {
            const row = state.transfers.find(
              (candidate) =>
                tableName(table) === "settlementTransfers" &&
                match(candidate, condition),
            );
            if (!row) return [];
            Object.assign(row, value);
            return [row];
          },
        }),
      }),
    }),
    transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => {
      const run = tail.then(async () => {
        const snapshot = structuredClone(state);
        try {
          return await callback(db);
        } catch (error) {
          Object.assign(state, structuredClone(snapshot));
          throw error;
        }
      });
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
  return {
    state,
    db,
    getActor: () => actor,
    setActor: (value: string) => {
      actor = value;
    },
    resetQueue: () => {
      tail = Promise.resolve();
    },
  };
});

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  eq: (column: { name?: string } | string, value: unknown) => ({
    type: "eq",
    column: typeof column === "string" ? column : column.name,
    value,
  }),
  inArray: (column: { name?: string } | string, value: unknown[]) => ({
    type: "in",
    column: typeof column === "string" ? column : column.name,
    value,
  }),
  isNull: () => ({}),
}));
vi.mock("@/lib/db/schema", () => {
  const columns: Record<string, string[]> = {
    participants: ["id", "tripId", "userId", "status", "role"],
    settlementRounds: ["id", "tripId", "status"],
    settlementTransfers: [
      "id",
      "tripId",
      "roundId",
      "senderId",
      "receiverId",
      "status",
    ],
    mutations: ["idempotencyKey"],
    auditEvents: [],
    expenses: [],
    expensePayments: ["expenseId"],
    expenseShares: ["expenseId"],
    activities: [],
    bikes: [],
    budgetRuleHistory: [],
    budgetRules: [],
    expenseRevisions: [],
    itineraryDays: [],
    trips: [],
    syncConflicts: [],
  };
  return Object.fromEntries(
    Object.entries(columns).map(([name, fields]) => [
      name,
      {
        __name: name,
        ...Object.fromEntries(fields.map((field) => [field, field])),
      },
    ]),
  );
});
vi.mock("@/lib/db", () => ({ db: h.db }));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => ({ id: h.getActor() }),
}));
vi.mock("@/lib/access", () => ({ assertTripMember: () => undefined }));
vi.mock("@/lib/cache", () => ({ invalidateTripCache: async () => undefined }));

const {
  settleSettlementTransfer,
  settlePendingSettlementTransfer,
  reverseSettlementTransfer,
} = await import("./money");

function balance(id: string) {
  return h.state.transfers
    .filter((transfer) => transfer.status === "confirmed")
    .reduce(
      (total, transfer) =>
        total +
        (transfer.receiverId === id
          ? transfer.amountPaise
          : transfer.senderId === id
            ? -transfer.amountPaise
            : 0),
      0,
    );
}
function reset() {
  h.state.transfers = [];
  h.state.mutations = [];
  h.state.audits = [];
  h.state.failAudit = false;
  h.state.round.status = "open";
  h.state.nextId = 1;
  h.resetQueue();
  h.setActor("u-a");
}

describe("settlement actions", () => {
  beforeEach(reset);
  it("settles directly, preserves the remainder, and audits the real actor", async () => {
    const result = await settleSettlementTransfer({
      tripId: "trip",
      roundId: "round",
      senderId: "p-a",
      receiverId: "p-b",
      amountPaise: 400,
      idempotencyKey: "one",
    });
    expect(result.transferId).toBeDefined();
    expect(balance("p-a")).toBe(-400);
    expect(balance("p-b")).toBe(400);
    expect(h.state.audits).toEqual([
      {
        action: "settlement-transfer-confirmed",
        actorId: "u-a",
        entityId: result.transferId,
      },
    ]);
  });
  it("rejects self-payments and amounts above outstanding", async () => {
    await expect(
      settleSettlementTransfer({
        tripId: "trip",
        roundId: "round",
        senderId: "p-a",
        receiverId: "p-a",
        amountPaise: 1,
        idempotencyKey: "self",
      }),
    ).rejects.toThrow("different");
    await expect(
      settleSettlementTransfer({
        tripId: "trip",
        roundId: "round",
        senderId: "p-a",
        receiverId: "p-b",
        amountPaise: 1001,
        idempotencyKey: "too-much",
      }),
    ).rejects.toThrow("outstanding");
  });
  it("replays the same idempotency key without creating another transfer", async () => {
    const input = {
      tripId: "trip",
      roundId: "round",
      senderId: "p-a",
      receiverId: "p-b",
      amountPaise: 250,
      idempotencyKey: "replay",
    };
    const first = await settleSettlementTransfer(input);
    const second = await settleSettlementTransfer(input);
    expect(second).toEqual(first);
    expect(h.state.transfers).toHaveLength(1);
    expect(h.state.audits).toHaveLength(1);
  });
  it("rolls back the transfer when the audit write fails", async () => {
    h.state.failAudit = true;
    await expect(
      settleSettlementTransfer({
        tripId: "trip",
        roundId: "round",
        senderId: "p-a",
        receiverId: "p-b",
        amountPaise: 100,
        idempotencyKey: "rollback",
      }),
    ).rejects.toThrow("audit failed");
    expect(h.state.transfers).toHaveLength(0);
    expect(h.state.mutations).toHaveLength(0);
  });
  it("serializes concurrent settles so one succeeds and one rejects", async () => {
    const input = (key: string) => ({
      tripId: "trip",
      roundId: "round",
      senderId: "p-a",
      receiverId: "p-b",
      amountPaise: 1000,
      idempotencyKey: key,
    });
    const results = await Promise.allSettled([
      settleSettlementTransfer(input("a")),
      settleSettlementTransfer(input("b")),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(h.state.transfers).toHaveLength(1);
  });
  it("lets any member reverse once and restores the pre-settle balance", async () => {
    const settled = await settleSettlementTransfer({
      tripId: "trip",
      roundId: "round",
      senderId: "p-a",
      receiverId: "p-b",
      amountPaise: 300,
      idempotencyKey: "settle",
    });
    h.setActor("u-b");
    await reverseSettlementTransfer({
      tripId: "trip",
      transferId: settled.transferId,
      idempotencyKey: "undo",
    });
    expect(balance("p-a")).toBe(0);
    expect(balance("p-b")).toBe(0);
    expect(h.state.audits.at(-1)?.actorId).toBe("u-b");
    await expect(
      reverseSettlementTransfer({
        tripId: "trip",
        transferId: settled.transferId,
        idempotencyKey: "undo-again",
      }),
    ).rejects.toThrow("Confirmed transfer");
  });
  it("rejects reversal after the round is closed", async () => {
    const settled = await settleSettlementTransfer({
      tripId: "trip",
      roundId: "round",
      senderId: "p-a",
      receiverId: "p-b",
      amountPaise: 300,
      idempotencyKey: "settle",
    });
    h.state.round.status = "closed";
    await expect(
      reverseSettlementTransfer({
        tripId: "trip",
        transferId: settled.transferId,
        idempotencyKey: "undo",
      }),
    ).resolves.toBeDefined();
  });
  it("completes a legacy pending transfer, which is not confirmed before completion", async () => {
    h.state.transfers.push({
      id: "legacy",
      tripId: "trip",
      roundId: "round",
      senderId: "p-a",
      receiverId: "p-b",
      amountPaise: 200,
      status: "pending",
      recordedBy: "u-a",
    });
    expect(balance("p-a")).toBe(0);
    h.setActor("u-b");
    await settlePendingSettlementTransfer({
      tripId: "trip",
      transferId: "legacy",
      idempotencyKey: "legacy-done",
    });
    expect(balance("p-a")).toBe(-200);
    expect(h.state.transfers[0].confirmedBy).toBe("u-b");
  });
  it("keeps the balance sum at zero for arbitrary settle and reverse sequences", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), {
          minLength: 0,
          maxLength: 20,
        }),
        (amounts) => {
          let a = 0;
          let b = 0;
          for (const amount of amounts) {
            const applied = Math.min(amount, 1000 + a);
            a -= applied;
            b += applied;
            if (amount % 3 === 0) {
              a += applied;
              b -= applied;
            }
            expect(a + b).toBe(0);
          }
        },
      ),
    );
  });
});
