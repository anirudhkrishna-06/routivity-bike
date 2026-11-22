export type SelectorPerson = {
  participantId: string;
  name: string;
  netPaise: number;
  paidPaise: number;
  sharePaise: number;
};
export type SelectorExpense = {
  id: string;
  description: string | null;
  category: string;
  expenseDate: string;
  amountPaise: number;
  reversedAt: string | null;
  createdAt?: string;
  payments: { participantId: string; amountPaise: number }[];
  shares: { participantId: string; amountPaise: number }[];
};
export type SelectorTransfer = {
  id: string;
  roundId: string;
  senderId: string;
  receiverId: string;
  amountPaise: number;
  status: string;
  createdAt?: string;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
};
export type SelectorRound = {
  id: string;
  status: string;
  createdAt: string;
  closedAt?: string | null;
  snapshot?: { participantId: string; netPaise: number }[];
};
export type SelectorSuggestion = {
  id?: string;
  senderId: string;
  receiverId: string;
  amountPaise: number;
};
export function activeExpenses(expenses: SelectorExpense[]) {
  return expenses.filter((item) => !item.reversedAt);
}
export function totalSpent(expenses: SelectorExpense[]) {
  return activeExpenses(expenses).reduce(
    (sum, item) => sum + item.amountPaise,
    0,
  );
}
export function position(people: SelectorPerson[], currentUserId: string) {
  const net =
    people.find((person) => person.participantId === currentUserId)?.netPaise ??
    0;
  const owedBy = people.filter(
    (person) => person.participantId !== currentUserId && person.netPaise < 0,
  );
  const owingTo = people.filter(
    (person) => person.participantId !== currentUserId && person.netPaise > 0,
  );
  return { net, owedBy, owingTo };
}
export function lateExpenseCount(
  expenses: SelectorExpense[],
  round?: SelectorRound,
) {
  if (!round || round.status !== "open") return 0;
  const started = new Date(round.createdAt).getTime();
  return activeExpenses(expenses).filter(
    (expense) =>
      expense.createdAt && new Date(expense.createdAt).getTime() > started,
  ).length;
}
export function orderedTransfers(
  suggestions: SelectorSuggestion[],
  transfers: SelectorTransfer[],
  currentUserId: string,
) {
  const all = [
    ...suggestions.map((item) => ({ ...item, kind: "suggested" as const })),
    ...transfers
      .filter(
        (item) => item.status === "pending" || item.status === "confirmed",
      )
      .map((item) => ({
        ...item,
        kind: item.status as "pending" | "confirmed",
      })),
  ];
  return all.sort(
    (a, b) =>
      Number(
        !(a.senderId === currentUserId || a.receiverId === currentUserId),
      ) -
      Number(!(b.senderId === currentUserId || b.receiverId === currentUserId)),
  );
}
export function roundTotals(
  round: SelectorRound,
  transfers: SelectorTransfer[],
) {
  const items = transfers.filter(
    (item) =>
      item.roundId === round.id &&
      (item.status === "pending" || item.status === "confirmed"),
  );
  const settled = items
    .filter((item) => item.status === "confirmed")
    .reduce((sum, item) => sum + item.amountPaise, 0);
  const total = (round.snapshot || [])
    .filter((item) => item.netPaise < 0)
    .reduce((sum, item) => sum + Math.abs(item.netPaise), 0);
  return {
    settled,
    total,
    pending: items
      .filter((item) => item.status === "pending")
      .reduce((sum, item) => sum + item.amountPaise, 0),
    payments: items.length,
  };
}
export function groupExpenses(expenses: SelectorExpense[]) {
  return activeExpenses(expenses).reduce<Record<string, SelectorExpense[]>>(
    (groups, expense) => {
      (groups[expense.expenseDate] ||= []).push(expense);
      return groups;
    },
    {},
  );
}
