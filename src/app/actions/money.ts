"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activities,
  auditEvents,
  bikes,
  budgetRuleHistory,
  budgetRules,
  expensePayments,
  expenseRevisions,
  expenses,
  expenseShares,
  itineraryDays,
  participants,
  settlementRounds,
  settlementTransfers,
  mutations,
  trips,
  syncConflicts,
} from "@/lib/db/schema";
import { invalidateTripCache } from "@/lib/cache";
import { assertTripMember } from "@/lib/access";

type PaymentInput = { participantId: string; amountPaise: number };
type ShareInput = { participantId: string; amountPaise: number };
type ExpenseInput = {
  tripId: string;
  idempotencyKey: string;
  amountPaise: number;
  description?: string;
  category: string;
  expenseDate: string;
  payments: PaymentInput[];
  shares: ShareInput[];
  activityId?: string;
  bikeId?: string;
  litresMilli?: number;
  odometerKmMilli?: number;
};
type Db = NonNullable<typeof db>;
type Tx = Pick<Db, "select" | "insert" | "update" | "delete">;

async function requireMember(tripId: string, ownerOnly = false) {
  const user = await getCurrentUser();
  if (!user || !db) throw new Error("Authentication required");
  const membership = await db.query.participants.findFirst({
    where: and(
      eq(participants.tripId, tripId),
      eq(participants.userId, user.id),
      eq(participants.status, "active"),
    ),
  });
  assertTripMember(
    membership
      ? {
          tripId,
          userId: user.id,
          status: membership.status,
          role: membership.role,
        }
      : null,
    tripId,
  );
  if (ownerOnly && membership?.role !== "owner")
    throw new Error("Owner access required");
  return { user, membership };
}
function positiveInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(label + " must be a positive integer number of paise");
}
function total(items: { amountPaise: number }[]) {
  return items.reduce((sum, item) => sum + item.amountPaise, 0);
}
async function assertParticipants(tripId: string, ids: string[]) {
  if (!db || !ids.length || new Set(ids).size !== ids.length)
    throw new Error("Participants must be unique and non-empty");
  const found = await db.query.participants.findMany({
    where: and(eq(participants.tripId, tripId), inArray(participants.id, ids)),
  });
  if (found.length !== ids.length)
    throw new Error("Every payer and share recipient must belong to this trip");
}
async function audit(
  tripId: string,
  actorId: string,
  action: string,
  entityId: string,
  details: unknown,
  tx?: Tx,
) {
  const executor = tx || db;
  if (!executor) throw new Error("Database is not configured");
  await executor.insert(auditEvents).values({
    tripId,
    actorId,
    action,
    entityType: "money",
    entityId,
    details: JSON.stringify(details),
  });
}
async function idempotentResult(input: { idempotencyKey: string }) {
  if (!db) throw new Error("Database is not configured");
  const existing = await db.query.mutations.findFirst({
    where: eq(mutations.idempotencyKey, input.idempotencyKey),
  });
  return existing
    ? (JSON.parse(existing.result) as Record<string, string>)
    : null;
}

export async function createExpense(input: ExpenseInput) {
  const { user } = await requireMember(input.tripId);
  positiveInteger(input.amountPaise, "Amount");
  if (!input.expenseDate || !input.category)
    throw new Error("Expense date and category are required");
  const replay = await idempotentResult(input);
  if (replay) return replay;
  await assertParticipants(input.tripId, [
    ...input.payments.map((item) => item.participantId),
    ...input.shares.map((item) => item.participantId),
  ]);
  input.payments.forEach((item) =>
    positiveInteger(item.amountPaise, "Payment"),
  );
  input.shares.forEach((item) => positiveInteger(item.amountPaise, "Share"));
  if (total(input.payments) !== input.amountPaise)
    throw new Error("Payments must add up exactly to the expense amount");
  if (total(input.shares) !== input.amountPaise)
    throw new Error("Shares must add up exactly to the expense amount");
  const result = await db!.transaction(async (tx) => {
    const [expense] = await tx
      .insert(expenses)
      .values({
        tripId: input.tripId,
        activityId: input.activityId,
        description: input.description?.trim() || null,
        category: input.category,
        expenseDate: input.expenseDate,
        enteredBy: user.id,
        bikeId: input.bikeId,
        amountPaise: input.amountPaise,
        litres: input.litresMilli,
        odometerKm: input.odometerKmMilli,
      })
      .returning();
    await tx.insert(expensePayments).values(
      input.payments.map((item) => ({
        expenseId: expense.id,
        participantId: item.participantId,
        amountPaise: item.amountPaise,
      })),
    );
    await tx.insert(expenseShares).values(
      input.shares.map((item) => ({
        expenseId: expense.id,
        participantId: item.participantId,
        amountPaise: item.amountPaise,
      })),
    );
    await audit(
      input.tripId,
      user.id,
      "created",
      expense.id,
      { amountPaise: input.amountPaise, category: input.category },
      tx,
    );
    const payload = { expenseId: expense.id };
    await tx.insert(mutations).values({
      idempotencyKey: input.idempotencyKey,
      tripId: input.tripId,
      actorId: user.id,
      result: JSON.stringify(payload),
    });
    return payload;
  });
  await invalidateTripCache(input.tripId);
  return result;
}

export async function editExpense(input: {
  tripId: string;
  expenseId: string;
  idempotencyKey: string;
  baseVersion?: number;
  change: Partial<ExpenseInput>;
}) {
  const { user } = await requireMember(input.tripId);
  const replay = await idempotentResult(input);
  if (replay) return replay;
  const current = await db!.query.expenses.findFirst({
    where: and(
      eq(expenses.id, input.expenseId),
      eq(expenses.tripId, input.tripId),
    ),
  });
  if (!current || current.reversedAt)
    throw new Error("Expense not found or already reversed");
  if (
    input.baseVersion !== undefined &&
    input.baseVersion !== current.version
  ) {
    const conflict = await db!
      .insert(syncConflicts)
      .values({
        tripId: input.tripId,
        entityType: "expense",
        entityId: current.id,
        base: { version: input.baseVersion },
        mine: input.change,
        theirs: current,
        createdBy: user.id,
      })
      .returning({ id: syncConflicts.id });
    throw new Error("CONFLICT:" + conflict[0].id);
  }
  const amountPaise = input.change.amountPaise ?? current.amountPaise;
  const payments =
    input.change.payments ??
    (await db!.query.expensePayments.findMany({
      where: eq(expensePayments.expenseId, current.id),
    }));
  const shares =
    input.change.shares ??
    (await db!.query.expenseShares.findMany({
      where: eq(expenseShares.expenseId, current.id),
    }));
  if (total(payments) !== amountPaise || total(shares) !== amountPaise)
    throw new Error("Payments and shares must both equal the expense amount");
  const result = await db!.transaction(async (tx) => {
    await tx.insert(expenseRevisions).values({
      expenseId: current.id,
      actorId: user.id,
      version: current.version,
      before: current,
      after: input.change,
    });
    await tx
      .delete(expensePayments)
      .where(eq(expensePayments.expenseId, current.id));
    await tx
      .delete(expenseShares)
      .where(eq(expenseShares.expenseId, current.id));
    await tx.insert(expensePayments).values(
      payments.map((item) => ({
        expenseId: current.id,
        participantId: item.participantId,
        amountPaise: item.amountPaise,
      })),
    );
    await tx.insert(expenseShares).values(
      shares.map((item) => ({
        expenseId: current.id,
        participantId: item.participantId,
        amountPaise: item.amountPaise,
      })),
    );
    const [updated] = await tx
      .update(expenses)
      .set({
        amountPaise,
        description: input.change.description ?? current.description,
        category: input.change.category ?? current.category,
        expenseDate: input.change.expenseDate ?? current.expenseDate,
        activityId: input.change.activityId ?? current.activityId,
        bikeId: input.change.bikeId ?? current.bikeId,
        litres: input.change.litresMilli ?? current.litres,
        odometerKm: input.change.odometerKmMilli ?? current.odometerKm,
        version: current.version + 1,
      })
      .where(eq(expenses.id, current.id))
      .returning();
    await audit(input.tripId, user.id, "revised", current.id, input.change, tx);
    const payload = { expenseId: updated.id };
    await tx.insert(mutations).values({
      idempotencyKey: input.idempotencyKey,
      tripId: input.tripId,
      actorId: user.id,
      result: JSON.stringify(payload),
    });
    return payload;
  });
  await invalidateTripCache(input.tripId);
  return result;
}

export async function reverseExpense(input: {
  tripId: string;
  expenseId: string;
  reason: string;
  idempotencyKey: string;
}) {
  const { user } = await requireMember(input.tripId);
  if (!input.reason.trim()) throw new Error("A reversal reason is required");
  const replay = await idempotentResult(input);
  if (replay) return replay;
  const result = await db!.transaction(async (tx) => {
    const [updated] = await tx
      .update(expenses)
      .set({
        reversedAt: new Date(),
        reversalReason: input.reason.trim(),
        version: 1,
      })
      .where(
        and(
          eq(expenses.id, input.expenseId),
          eq(expenses.tripId, input.tripId),
          isNull(expenses.reversedAt),
        ),
      )
      .returning();
    if (!updated) throw new Error("Expense not found or already reversed");
    await audit(
      input.tripId,
      user.id,
      "reversed",
      updated.id,
      { reason: input.reason.trim() },
      tx,
    );
    const payload = { expenseId: updated.id };
    await tx.insert(mutations).values({
      idempotencyKey: input.idempotencyKey,
      tripId: input.tripId,
      actorId: user.id,
      result: JSON.stringify(payload),
    });
    return payload;
  });
  await invalidateTripCache(input.tripId);
  return result;
}

async function calculateBalances(
  tripId: string,
  preloaded?: {
    members?: (typeof participants.$inferSelect)[];
    expenseRows?: (typeof expenses.$inferSelect)[];
    payments?: (typeof expensePayments.$inferSelect)[];
    shares?: (typeof expenseShares.$inferSelect)[];
    confirmedTransfers?: (typeof settlementTransfers.$inferSelect)[];
  },
) {
  const members =
    preloaded?.members ??
    (await db!.query.participants.findMany({
      where: eq(participants.tripId, tripId),
    }));
  const expenseRows =
    preloaded?.expenseRows ??
    (await db!.query.expenses.findMany({
      where: and(eq(expenses.tripId, tripId), isNull(expenses.reversedAt)),
    }));
  const activeExpenseIds = expenseRows.map((expense) => expense.id);

  let payments = preloaded?.payments;
  let shares = preloaded?.shares;

  if (!payments || !shares) {
    if (activeExpenseIds.length === 0) {
      payments = payments ?? [];
      shares = shares ?? [];
    } else {
      const [fetchedPayments, fetchedShares] = await Promise.all([
        payments
          ? Promise.resolve(payments)
          : db!.query.expensePayments.findMany({
              where: inArray(expensePayments.expenseId, activeExpenseIds),
            }),
        shares
          ? Promise.resolve(shares)
          : db!.query.expenseShares.findMany({
              where: inArray(expenseShares.expenseId, activeExpenseIds),
            }),
      ]);
      payments = fetchedPayments;
      shares = fetchedShares;
    }
  }

  const confirmedTransfers =
    preloaded?.confirmedTransfers ??
    (await db!.query.settlementTransfers.findMany({
      where: and(
        eq(settlementTransfers.tripId, tripId),
        eq(settlementTransfers.status, "confirmed"),
      ),
    }));

  const activeExpenseSet = new Set(activeExpenseIds);
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  for (const payment of payments)
    if (activeExpenseSet.has(payment.expenseId))
      paid.set(
        payment.participantId,
        (paid.get(payment.participantId) || 0) + payment.amountPaise,
      );
  for (const share of shares)
    if (activeExpenseSet.has(share.expenseId))
      owed.set(
        share.participantId,
        (owed.get(share.participantId) || 0) + share.amountPaise,
      );
  for (const transfer of confirmedTransfers) {
    paid.set(
      transfer.receiverId,
      (paid.get(transfer.receiverId) || 0) + transfer.amountPaise,
    );
    paid.set(
      transfer.senderId,
      (paid.get(transfer.senderId) || 0) - transfer.amountPaise,
    );
  }
  return members
    .map((participant) => ({
      participantId: participant.id,
      name: participant.name,
      paidPaise: paid.get(participant.id) || 0,
      sharePaise: owed.get(participant.id) || 0,
      netPaise:
        (paid.get(participant.id) || 0) - (owed.get(participant.id) || 0),
    }))
    .filter((item) => item.paidPaise || item.sharePaise || members.length);
}
function greedySuggestions(
  balances: { participantId: string; netPaise: number }[],
) {
  const creditors = balances
    .filter((item) => item.netPaise > 0)
    .map((item) => ({ ...item }))
    .sort((a, b) => b.netPaise - a.netPaise);
  const debtors = balances
    .filter((item) => item.netPaise < 0)
    .map((item) => ({ ...item, netPaise: -item.netPaise }))
    .sort((a, b) => b.netPaise - a.netPaise);
  const result: {
    senderId: string;
    receiverId: string;
    amountPaise: number;
  }[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amountPaise = Math.min(debtors[d].netPaise, creditors[c].netPaise);
    result.push({
      senderId: debtors[d].participantId,
      receiverId: creditors[c].participantId,
      amountPaise,
    });
    debtors[d].netPaise -= amountPaise;
    creditors[c].netPaise -= amountPaise;
    if (!debtors[d].netPaise) d++;
    if (!creditors[c].netPaise) c++;
  }
  return result;
}
function minimumSuggestions(
  balances: { participantId: string; netPaise: number }[],
) {
  const items = balances
    .filter((item) => item.netPaise !== 0)
    .map((item) => ({ ...item }));
  if (items.length > 10) return greedySuggestions(balances);
  let best:
    { senderId: string; receiverId: string; amountPaise: number }[] | null =
    null;
  function search(
    start: number,
    transfers: { senderId: string; receiverId: string; amountPaise: number }[],
  ) {
    while (start < items.length && items[start].netPaise === 0) start++;
    if (start === items.length) {
      if (!best || transfers.length < best.length) best = [...transfers];
      return;
    }
    if (best && transfers.length >= best.length) return;
    for (let index = start + 1; index < items.length; index++) {
      if (
        items[start].netPaise === 0 ||
        items[start].netPaise * items[index].netPaise >= 0
      )
        continue;
      const amountPaise = Math.min(
        Math.abs(items[start].netPaise),
        Math.abs(items[index].netPaise),
      );
      const firstWasDebtor = items[start].netPaise < 0;
      items[start].netPaise += firstWasDebtor ? amountPaise : -amountPaise;
      items[index].netPaise += firstWasDebtor ? -amountPaise : amountPaise;
      transfers.push(
        firstWasDebtor
          ? {
              senderId: items[start].participantId,
              receiverId: items[index].participantId,
              amountPaise,
            }
          : {
              senderId: items[index].participantId,
              receiverId: items[start].participantId,
              amountPaise,
            },
      );
      search(start + 1, transfers);
      transfers.pop();
      items[index].netPaise += firstWasDebtor ? amountPaise : -amountPaise;
      items[start].netPaise += firstWasDebtor ? -amountPaise : amountPaise;
      if (items[start].netPaise === 0) break;
    }
  }
  search(0, []);
  return best || [];
}

export async function getMoneyOverview(tripId: string) {
  const { membership } = await requireMember(tripId);
  if (!db) throw new Error("Database is not configured");
  const [
    members,
    expenseRows,
    rules,
    rounds,
    transfers,
    trip,
    days,
    travelLegs,
    bikeRows,
    stayRows,
  ] = await Promise.all([
    db.query.participants.findMany({ where: eq(participants.tripId, tripId) }),
    db.query.expenses.findMany({
      where: eq(expenses.tripId, tripId),
      orderBy: (row, { desc }) => [desc(row.expenseDate), desc(row.createdAt)],
    }),
    db.query.budgetRules.findMany({
      where: and(eq(budgetRules.tripId, tripId), eq(budgetRules.active, true)),
    }),
    db.query.settlementRounds.findMany({
      where: eq(settlementRounds.tripId, tripId),
      orderBy: (row, { desc }) => [desc(row.createdAt)],
    }),
    db.query.settlementTransfers.findMany({
      where: eq(settlementTransfers.tripId, tripId),
      orderBy: (row, { desc }) => [desc(row.createdAt)],
    }),
    db.query.trips.findFirst({ where: eq(trips.id, tripId) }),
    db.query.itineraryDays.findMany({
      where: eq(itineraryDays.tripId, tripId),
    }),
    db.query.activities.findMany({
      where: and(
        eq(activities.tripId, tripId),
        eq(activities.type, "TRAVEL"),
        eq(activities.archived, false),
      ),
    }),
    db.query.bikes.findMany({ where: eq(bikes.tripId, tripId) }),
    db.query.activities.findMany({
      where: and(
        eq(activities.tripId, tripId),
        eq(activities.type, "STAY"),
        eq(activities.archived, false),
      ),
    }),
  ]);

  const allExpenseIds = expenseRows.map((e) => e.id);
  const [payments, shares] =
    allExpenseIds.length > 0
      ? await Promise.all([
          db.query.expensePayments.findMany({
            where: inArray(expensePayments.expenseId, allExpenseIds),
          }),
          db.query.expenseShares.findMany({
            where: inArray(expenseShares.expenseId, allExpenseIds),
          }),
        ])
      : [[], []];

  const activeExpenseRows = expenseRows.filter((e) => !e.reversedAt);
  const confirmedTransfers = transfers.filter((t) => t.status === "confirmed");
  const balances = await calculateBalances(tripId, {
    members,
    expenseRows: activeExpenseRows,
    payments,
    shares,
    confirmedTransfers,
  });
  const actualByCategory = new Map<string, number>();
  for (const row of expenseRows)
    if (!row.reversedAt)
      actualByCategory.set(
        row.category,
        (actualByCategory.get(row.category) || 0) + row.amountPaise,
      );
  const bikeMap = new Map(bikeRows.map((bike) => [bike.id, bike]));
  const derivedFuel = travelLegs.reduce((sum, leg) => {
    const bike = leg.bikeId ? bikeMap.get(leg.bikeId) : undefined;
    if (
      !leg.distanceKmMilli ||
      !bike?.mileageKmplMilli ||
      !bike.fuelPricePaisePerLitre
    )
      return sum;
    return (
      sum +
      Math.floor(
        (leg.distanceKmMilli * bike.fuelPricePaisePerLitre +
          Math.floor(bike.mileageKmplMilli / 2)) /
          bike.mileageKmplMilli,
      )
    );
  }, 0);
  const fuelExpenses = expenseRows
    .filter(
      (row) =>
        !row.reversedAt &&
        row.category === "FUEL" &&
        row.litres &&
        row.odometerKm,
    )
    .sort((a, b) => (a.odometerKm || 0) - (b.odometerKm || 0));
  const fuelInsights = bikeRows.map((bike) => {
    const legs = travelLegs.filter((leg) => leg.bikeId === bike.id);
    const plannedDistanceKm =
      legs.reduce((sum, leg) => sum + (leg.distanceKmMilli || 0), 0) / 1000;
    const actual = fuelExpenses.filter((row) => row.bikeId === bike.id);
    const litres =
      actual.reduce((sum, row) => sum + (row.litres || 0), 0) / 1000;
    const actualCostPaise = actual.reduce(
      (sum, row) => sum + row.amountPaise,
      0,
    );
    const first = actual[0]?.odometerKm ?? null;
    const last = actual.at(-1)?.odometerKm ?? null;
    const actualMileage =
      first !== null && last !== null && last > first && litres > 0
        ? (last - first) / 1000 / litres
        : null;
    return {
      bikeId: bike.id,
      bikeName: bike.name,
      assumedMileageKmpl: bike.mileageKmplMilli
        ? bike.mileageKmplMilli / 1000
        : null,
      fuelPricePaisePerLitre: bike.fuelPricePaisePerLitre,
      plannedDistanceKm,
      plannedFuelCostPaise: legs.reduce((sum, leg) => {
        if (
          !leg.distanceKmMilli ||
          !bike.mileageKmplMilli ||
          !bike.fuelPricePaisePerLitre
        )
          return sum;
        return (
          sum +
          Math.floor(
            (leg.distanceKmMilli * bike.fuelPricePaisePerLitre +
              Math.floor(bike.mileageKmplMilli / 2)) /
              bike.mileageKmplMilli,
          )
        );
      }, 0),
      actualLitres: litres,
      actualCostPaise,
      actualMileageKmpl: actualMileage,
    };
  });
  const budgetSummary = rules.map((rule) => {
    const remainingDays = trip
      ? Math.max(
          1,
          days.filter(
            (day) => day.date >= rule.effectiveFrom && day.date <= trip.endDate,
          ).length,
        )
      : 1;
    const plannedPaise =
      rule.ruleType === "PER_DAY"
        ? rule.amountPaise * remainingDays
        : rule.ruleType === "PER_NIGHT"
          ? rule.amountPaise * Math.max(0, remainingDays - 1)
          : rule.ruleType === "DERIVED" && rule.category === "FUEL"
            ? derivedFuel
            : rule.amountPaise;
    const actualPaise = actualByCategory.get(rule.category) || 0;
    const utilisation = plannedPaise ? actualPaise / plannedPaise : 0;
    return {
      ...rule,
      plannedPaise,
      actualPaise,
      variancePaise: actualPaise - plannedPaise,
      status:
        utilisation > 1
          ? "over"
          : utilisation >= 0.8
            ? "approaching"
            : "within",
    };
  });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: trip?.timezone || "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const activeExpenses = expenseRows.filter((row) => !row.reversedAt);
  const elapsedDays = trip
    ? Math.max(1, days.filter((day) => day.date <= today).length)
    : 0;
  const remainingDays = trip ? Math.max(0, days.length - elapsedDays) : 0;
  const actualTotalPaise = activeExpenses.reduce(
    (sum, row) => sum + row.amountPaise,
    0,
  );
  const remainingPlannedPaise = budgetSummary.reduce(
    (sum, row) => sum + Math.max(0, row.plannedPaise - row.actualPaise),
    0,
  );
  const forecast =
    activeExpenses.length >= 2 && elapsedDays > 0
      ? {
          projectedPaise:
            actualTotalPaise +
            Math.max(
              remainingPlannedPaise,
              Math.round(actualTotalPaise / elapsedDays) * remainingDays,
            ),
          remainingPlannedPaise,
          label: "Estimate based on current pace and remaining plan",
        }
      : null;
  return {
    expenses: expenseRows.map((row) => ({
      ...row,
      payments: payments.filter((item) => item.expenseId === row.id),
      shares: shares.filter((item) => item.expenseId === row.id),
    })),
    balances,
    suggestions: minimumSuggestions(balances),
    budgets: rules,
    budgetSummary,
    fuelInsights,
    forecast,
    rounds,
    transfers,
    currentUserId: membership!.id,
    today,
    stayOptions: stayRows.map((row) => ({
      id: row.id,
      label: row.location || row.title,
    })),
    bikeOptions: bikeRows.map((row) => ({ id: row.id, label: row.name })),
  };
}

export async function saveBudgetRule(input: {
  tripId: string;
  ruleId?: string;
  category: string;
  ruleType: string;
  amountPaise: number;
  effectiveFrom: string;
  idempotencyKey: string;
}) {
  const { user } = await requireMember(input.tripId);
  positiveInteger(input.amountPaise, "Budget amount");
  const replay = await idempotentResult(input);
  if (replay) return replay;
  const result = await db!.transaction(async (tx) => {
    let ruleId = input.ruleId;
    if (ruleId) {
      const existing = await tx
        .select()
        .from(budgetRules)
        .where(
          and(eq(budgetRules.id, ruleId), eq(budgetRules.tripId, input.tripId)),
        )
        .limit(1);
      if (!existing[0]) throw new Error("Budget rule not found");
      await tx
        .update(budgetRules)
        .set({ active: false })
        .where(eq(budgetRules.id, ruleId));
      const [next] = await tx
        .insert(budgetRules)
        .values({
          tripId: input.tripId,
          category: input.category,
          ruleType: input.ruleType,
          amountPaise: input.amountPaise,
          effectiveFrom: input.effectiveFrom,
          createdBy: user.id,
        })
        .returning();
      await tx.insert(budgetRuleHistory).values({
        budgetRuleId: next.id,
        actorId: user.id,
        oldAmountPaise: existing[0].amountPaise,
        newAmountPaise: input.amountPaise,
        effectiveFrom: input.effectiveFrom,
      });
      ruleId = next.id;
    } else {
      const [rule] = await tx
        .insert(budgetRules)
        .values({
          tripId: input.tripId,
          category: input.category,
          ruleType: input.ruleType,
          amountPaise: input.amountPaise,
          effectiveFrom: input.effectiveFrom,
          createdBy: user.id,
        })
        .returning();
      ruleId = rule.id;
    }
    await audit(input.tripId, user.id, "budget-changed", ruleId, input, tx);
    const payload = { ruleId };
    await tx.insert(mutations).values({
      idempotencyKey: input.idempotencyKey,
      tripId: input.tripId,
      actorId: user.id,
      result: JSON.stringify(payload),
    });
    return payload;
  });
  await invalidateTripCache(input.tripId);
  return result;
}

export async function startSettlementRound(input: {
  tripId: string;
  idempotencyKey: string;
}) {
  const { user } = await requireMember(input.tripId);
  const replay = await idempotentResult(input);
  if (replay) return replay;
  const balances = await calculateBalances(input.tripId);
  if (balances.reduce((sum, item) => sum + item.netPaise, 0) !== 0)
    throw new Error(
      "Integrity check failed: balances do not reconcile to zero",
    );
  const result = await db!.transaction(async (tx) => {
    const [round] = await tx
      .insert(settlementRounds)
      .values({ tripId: input.tripId, snapshot: balances, startedBy: user.id })
      .returning();
    await audit(
      input.tripId,
      user.id,
      "settlement-started",
      round.id,
      { balances },
      tx,
    );
    const payload = { roundId: round.id };
    await tx.insert(mutations).values({
      idempotencyKey: input.idempotencyKey,
      tripId: input.tripId,
      actorId: user.id,
      result: JSON.stringify(payload),
    });
    return payload;
  });
  return result;
}

export async function recordSettlementTransfer(input: {
  tripId: string;
  roundId: string;
  senderId: string;
  receiverId: string;
  amountPaise: number;
  idempotencyKey: string;
}) {
  const { user } = await requireMember(input.tripId);
  positiveInteger(input.amountPaise, "Transfer amount");
  if (input.senderId === input.receiverId)
    throw new Error("Sender and receiver must be different");
  const replay = await idempotentResult(input);
  if (replay) return replay;
  await assertParticipants(input.tripId, [input.senderId, input.receiverId]);
  const result = await db!.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(settlementRounds)
      .where(
        and(
          eq(settlementRounds.id, input.roundId),
          eq(settlementRounds.tripId, input.tripId),
          eq(settlementRounds.status, "open"),
        ),
      )
      .for("update");
    if (!round) throw new Error("Settlement round not found or already closed");
    const snapshot = round.snapshot as {
      participantId: string;
      netPaise: number;
    }[];
    const senderSnapshot =
      snapshot.find((item) => item.participantId === input.senderId)
        ?.netPaise || 0;
    const receiverSnapshot =
      snapshot.find((item) => item.participantId === input.receiverId)
        ?.netPaise || 0;
    const previous = await tx
      .select()
      .from(settlementTransfers)
      .where(
        and(
          eq(settlementTransfers.roundId, input.roundId),
          inArray(settlementTransfers.status, ["pending", "confirmed"]),
        ),
      );
    const outgoing = previous
      .filter((item) => item.senderId === input.senderId)
      .reduce((sum, item) => sum + item.amountPaise, 0);
    const incoming = previous
      .filter((item) => item.receiverId === input.receiverId)
      .reduce((sum, item) => sum + item.amountPaise, 0);
    if (
      senderSnapshot >= 0 ||
      receiverSnapshot <= 0 ||
      input.amountPaise > -senderSnapshot - outgoing ||
      input.amountPaise > receiverSnapshot - incoming
    )
      throw new Error("Transfer exceeds the round's outstanding balance");
    const [transfer] = await tx
      .insert(settlementTransfers)
      .values({
        tripId: input.tripId,
        roundId: input.roundId,
        senderId: input.senderId,
        receiverId: input.receiverId,
        amountPaise: input.amountPaise,
        recordedBy: user.id,
      })
      .returning();
    await audit(
      input.tripId,
      user.id,
      "settlement-transfer-recorded",
      transfer.id,
      { amountPaise: input.amountPaise },
      tx,
    );
    const payload = { transferId: transfer.id };
    await tx.insert(mutations).values({
      idempotencyKey: input.idempotencyKey,
      tripId: input.tripId,
      actorId: user.id,
      result: JSON.stringify(payload),
    });
    return payload;
  });
  return result;
}

export async function settleSettlementTransfer(input: {
  tripId: string;
  roundId: string;
  senderId: string;
  receiverId: string;
  amountPaise: number;
  idempotencyKey: string;
}) {
  const { user } = await requireMember(input.tripId);
  positiveInteger(input.amountPaise, "Transfer amount");
  if (input.senderId === input.receiverId)
    throw new Error("Sender and receiver must be different");
  const replay = await idempotentResult(input);
  if (replay) return replay;
  await assertParticipants(input.tripId, [input.senderId, input.receiverId]);
  const result = await db!.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(settlementRounds)
      .where(
        and(
          eq(settlementRounds.id, input.roundId),
          eq(settlementRounds.tripId, input.tripId),
          eq(settlementRounds.status, "open"),
        ),
      )
      .for("update");
    if (!round) throw new Error("Settlement round not found or already closed");
    const snapshot = round.snapshot as {
      participantId: string;
      netPaise: number;
    }[];
    const senderSnapshot =
      snapshot.find((item) => item.participantId === input.senderId)
        ?.netPaise || 0;
    const receiverSnapshot =
      snapshot.find((item) => item.participantId === input.receiverId)
        ?.netPaise || 0;
    const previous = await tx
      .select()
      .from(settlementTransfers)
      .where(
        and(
          eq(settlementTransfers.roundId, input.roundId),
          inArray(settlementTransfers.status, ["pending", "confirmed"]),
        ),
      );
    const outgoing = previous
      .filter((item) => item.senderId === input.senderId)
      .reduce((sum, item) => sum + item.amountPaise, 0);
    const incoming = previous
      .filter((item) => item.receiverId === input.receiverId)
      .reduce((sum, item) => sum + item.amountPaise, 0);
    if (
      senderSnapshot >= 0 ||
      receiverSnapshot <= 0 ||
      input.amountPaise > -senderSnapshot - outgoing ||
      input.amountPaise > receiverSnapshot - incoming
    )
      throw new Error("Transfer exceeds the round's outstanding balance");
    const [transfer] = await tx
      .insert(settlementTransfers)
      .values({
        tripId: input.tripId,
        roundId: input.roundId,
        senderId: input.senderId,
        receiverId: input.receiverId,
        amountPaise: input.amountPaise,
        recordedBy: user.id,
        confirmedBy: user.id,
        confirmedAt: new Date(),
        status: "confirmed",
      })
      .returning();
    await audit(
      input.tripId,
      user.id,
      "settlement-transfer-confirmed",
      transfer.id,
      { amountPaise: input.amountPaise, direct: true },
      tx,
    );
    const payload = { transferId: transfer.id };
    await tx.insert(mutations).values({
      idempotencyKey: input.idempotencyKey,
      tripId: input.tripId,
      actorId: user.id,
      result: JSON.stringify(payload),
    });
    return payload;
  });
  return result;
}

export async function settlePendingSettlementTransfer(input: {
  tripId: string;
  transferId: string;
  idempotencyKey: string;
}) {
  const { user } = await requireMember(input.tripId);
  const replay = await idempotentResult(input);
  if (replay) return replay;
  const result = await db!.transaction(async (tx) => {
    const [transfer] = await tx
      .update(settlementTransfers)
      .set({
        status: "confirmed",
        confirmedBy: user.id,
        confirmedAt: new Date(),
      })
      .where(
        and(
          eq(settlementTransfers.id, input.transferId),
          eq(settlementTransfers.tripId, input.tripId),
          eq(settlementTransfers.status, "pending"),
        ),
      )
      .returning();
    if (!transfer)
      throw new Error("Pending transfer not found or already completed");
    await audit(
      input.tripId,
      user.id,
      "settlement-transfer-confirmed",
      transfer.id,
      { direct: true, legacyPending: true },
      tx,
    );
    const payload = { transferId: transfer.id };
    await tx.insert(mutations).values({
      idempotencyKey: input.idempotencyKey,
      tripId: input.tripId,
      actorId: user.id,
      result: JSON.stringify(payload),
    });
    return payload;
  });
  return result;
}

export async function confirmSettlementTransfer(input: {
  tripId: string;
  transferId: string;
  onBehalfOf?: string;
}) {
  const { user } = await requireMember(input.tripId);
  const result = await db!.transaction(async (tx) => {
    const [transfer] = await tx
      .update(settlementTransfers)
      .set({
        status: "confirmed",
        confirmedBy: user.id,
        confirmedAt: new Date(),
      })
      .where(
        and(
          eq(settlementTransfers.id, input.transferId),
          eq(settlementTransfers.tripId, input.tripId),
          eq(settlementTransfers.status, "pending"),
        ),
      )
      .returning();
    if (!transfer) throw new Error("Transfer not found or already confirmed");
    await audit(
      input.tripId,
      user.id,
      "settlement-transfer-confirmed",
      transfer.id,
      { onBehalfOf: input.onBehalfOf },
      tx,
    );
    return transfer;
  });
  return result;
}

export async function reverseSettlementTransfer(input: {
  tripId: string;
  transferId: string;
  reason?: string;
  idempotencyKey: string;
}) {
  const { user } = await requireMember(input.tripId);
  const replay = await idempotentResult(input);
  if (replay) return replay;
  const result = await db!.transaction(async (tx) => {
    const [transfer] = await tx
      .update(settlementTransfers)
      .set({ status: "reversed", reversalReason: input.reason?.trim() || null })
      .where(
        and(
          eq(settlementTransfers.id, input.transferId),
          eq(settlementTransfers.tripId, input.tripId),
          eq(settlementTransfers.status, "confirmed"),
        ),
      )
      .returning();
    if (!transfer) throw new Error("Confirmed transfer not found");
    await audit(
      input.tripId,
      user.id,
      "settlement-transfer-reversed",
      transfer.id,
      { reason: input.reason?.trim() || null },
      tx,
    );
    const payload = { transferId: transfer.id };
    await tx.insert(mutations).values({
      idempotencyKey: input.idempotencyKey,
      tripId: input.tripId,
      actorId: user.id,
      result: JSON.stringify(payload),
    });
    return payload;
  });
  return result;
}

export async function closeSettlementRound(input: {
  tripId: string;
  roundId: string;
}) {
  const { user } = await requireMember(input.tripId);
  const [round] = await db!
    .update(settlementRounds)
    .set({ status: "closed", closedAt: new Date() })
    .where(
      and(
        eq(settlementRounds.id, input.roundId),
        eq(settlementRounds.tripId, input.tripId),
        eq(settlementRounds.status, "open"),
      ),
    )
    .returning();
  if (!round) throw new Error("Round not found or already closed");
  await audit(input.tripId, user.id, "settlement-closed", round.id, {});
  return round;
}

export async function listSyncConflicts(tripId: string) {
  await requireMember(tripId);
  if (!db) throw new Error("Database is not configured");
  return db.query.syncConflicts.findMany({
    where: and(
      eq(syncConflicts.tripId, tripId),
      eq(syncConflicts.status, "open"),
    ),
    orderBy: (row, { desc }) => [desc(row.createdAt)],
  });
}
export async function resolveSyncConflict(input: {
  tripId: string;
  conflictId: string;
  resolution: "mine" | "theirs" | "merged";
  merged?: Record<string, unknown>;
}) {
  const { user } = await requireMember(input.tripId);
  if (!db) throw new Error("Database is not configured");
  const [conflict] = await db
    .update(syncConflicts)
    .set({
      status: "resolved",
      resolution: { choice: input.resolution, merged: input.merged || null },
      resolvedAt: new Date(),
    })
    .where(
      and(
        eq(syncConflicts.id, input.conflictId),
        eq(syncConflicts.tripId, input.tripId),
        eq(syncConflicts.status, "open"),
      ),
    )
    .returning();
  if (!conflict) throw new Error("Conflict not found or already resolved");
  await audit(input.tripId, user.id, "sync-conflict-resolved", conflict.id, {
    resolution: input.resolution,
    merged: input.merged || null,
  });
  return conflict;
}
