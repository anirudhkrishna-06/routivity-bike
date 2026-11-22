"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleDollarSign,
  Info,
  Plus,
  RotateCcw,
  Share2,
  WalletCards,
  X,
} from "lucide-react";
import {
  ExpenseForm,
  type Expense,
  type MoneyData,
  type Person,
  type Round,
  type Suggestion,
  type Transfer,
} from "./money-workspace";
import { formatDay } from "@/lib/date-format";
import { formatMoney } from "@/lib/money-format";
import {
  activeExpenses,
  groupExpenses,
  lateExpenseCount,
  orderedTransfers,
  position,
  roundTotals,
  totalSpent,
} from "@/lib/selectors";
import { motion } from "@/lib/motion";
import { flushPendingMutations } from "@/lib/queue-sync";
import { pendingMutationCount } from "@/lib/local-queue";

type View = "settle" | "expenses" | "history";
const labels: Record<string, string> = {
  FOOD: "Food",
  STAY: "Stay",
  PRE_REQ: "Pre-trip",
  FUEL: "Fuel",
  PARKING_TOLLS: "Parking",
  EXPLORATION: "Tickets",
  SHOPPING: "Shopping",
  MISCELLANEOUS: "Other",
};
const categories = ["ALL", ...Object.keys(labels)];
const iconFor = (category: string) =>
  category === "FOOD"
    ? "🍽"
    : category === "STAY"
      ? "🛏"
      : category === "FUEL"
        ? "⛽"
        : category === "EXPLORATION"
          ? "🎟"
          : "◉";

function CountMoney({ amount }: { amount: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const counter = { value: 0 };
      gsap.to(counter, {
        value: amount,
        duration: 0.42,
        ease: motion.ease,
        onUpdate: () => {
          if (ref.current)
            ref.current.textContent = formatMoney(Math.round(counter.value));
        },
      });
    },
    { dependencies: [amount] },
  );
  return <span ref={ref}>{formatMoney(amount)}</span>;
}

export function MoneySettlementWorkspace({
  tripId,
  openExpense,
}: {
  tripId: string;
  openExpense?: boolean;
}) {
  const [data, setData] = useState<MoneyData | null>(null);
  const [view, setView] = useState<View>("settle");
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<
    "expense" | "record" | "detail" | "breakdown" | "reverse" | "info" | null
  >(openExpense ? "expense" : null);
  const [selectedExpense, setSelectedExpense] = useState<Expense>();
  const [selectedPerson, setSelectedPerson] = useState<Person>();
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion>();
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer>();
  const [toast, setToast] = useState<string>();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [pending, setPending] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [syncCount, setSyncCount] = useState(0);
  const [online, setOnline] = useState(true);
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.fromTo(
          ".money-hub-card",
          { opacity: 0 },
          { opacity: 1, duration: 0.2, stagger: 0.03 },
        );
      });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".money-hub-card",
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: motion.normal,
            ease: motion.ease,
            stagger: 0.045,
          },
        );
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [view, data] },
  );
  async function load() {
    try {
      const response = await fetch(`/api/trips/${tripId}/money`, {
        cache: "no-store",
      });
      const body = (await response.json()) as MoneyData & { error?: string };
      if (!response.ok)
        throw new Error(body.error || "Unable to load money data.");
      setData(body);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load money data.",
      );
    }
  }
  useEffect(() => {
    setOnline(navigator.onLine);
    const refreshSync = () => {
      setOnline(navigator.onLine);
      void pendingMutationCount().then(setSyncCount);
    };
    void pendingMutationCount().then(setSyncCount);
    window.addEventListener("online", refreshSync);
    window.addEventListener("offline", refreshSync);
    window.addEventListener("routivity-refresh", refreshSync);
    void load();
    const onOnline = () => {
      void flushPendingMutations().then(load);
    };
    const onRefresh = () => {
      void load();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("routivity-refresh", onRefresh);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("routivity-refresh", onRefresh);
      window.removeEventListener("online", refreshSync);
      window.removeEventListener("offline", refreshSync);
      window.removeEventListener("routivity-refresh", refreshSync);
    };
  }, [tripId]);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("view");
    if (value === "settle" || value === "expenses" || value === "history")
      setView(value);
  }, []);
  function selectView(next: View) {
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState({}, "", url);
  }
  async function action(
    operation: string,
    payload: Record<string, unknown>,
    route = "settlement",
  ) {
    setPending(true);
    try {
      const response = await fetch(`/api/trips/${tripId}/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          payload: {
            ...payload,
            ...(operation === "start" ||
            operation === "record" ||
            operation === "settle" ||
            operation === "settle-pending" ||
            operation === "reverse"
              ? { idempotencyKey: crypto.randomUUID() }
              : {}),
          },
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        transferId?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "That action could not be completed.");
      setSheet(null);
      if (
        (operation === "settle" || operation === "settle-pending") &&
        body.transferId
      ) {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast(body.transferId);
        toastTimer.current = setTimeout(() => setToast(undefined), 8000);
      }
      if (operation === "reverse") {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast(undefined);
      }
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "That action could not be completed.",
      );
    } finally {
      setPending(false);
    }
  }
  const people = data?.balances || [];
  const current = data?.currentUserId || "";
  const openRound = (data?.rounds || []).find(
    (round) => round.status === "open",
  );
  const selected =
    selectedSuggestion ||
    (selectedTransfer
      ? {
          senderId: selectedTransfer.senderId,
          receiverId: selectedTransfer.receiverId,
          amountPaise: selectedTransfer.amountPaise,
        }
      : undefined);
  if (!data)
    return (
      <section className="money-hub" ref={root}>
        <div className="money-hub-skeleton" />
        <div className="money-hub-skeleton short" />
      </section>
    );
  return (
    <section className="money-hub" ref={root}>
      <nav className="money-segments" role="tablist" aria-label="Money views">
        <i
          className="segment-indicator"
          style={{
            transform: `translateX(${view === "settle" ? 0 : view === "expenses" ? 100 : 200}%)`,
          }}
          aria-hidden="true"
        />
        {(["settle", "expenses", "history"] as View[]).map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={view === item}
            className={view === item ? "active" : ""}
            onClick={() => selectView(item)}
          >
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>
      <div className="sync-indicator" aria-live="polite">
        {online ? (syncCount ? `${syncCount} pending` : "Synced") : "Offline"}
      </div>
      {error && (
        <div className="money-inline-error" role="alert">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button onClick={() => void load()}>Retry</button>
        </div>
      )}
      {view === "settle" && (
        <SettleView
          data={data}
          openRound={openRound}
          pending={pending}
          onAdd={() => {
            setSelectedExpense(undefined);
            setSheet("expense");
          }}
          onInfo={() => setSheet("info")}
          onStart={() => void action("start", {})}
          onFinish={() => {
            if (openRound) {
              const totals = roundTotals(
                openRound as never,
                (data.transfers || []) as never,
              );
              if (
                totals.total - totals.settled > 0 &&
                !window.confirm(
                  `${formatMoney(totals.total - totals.settled)} is still unpaid and will carry into the next round.`,
                )
              )
                return;
              void action("close", { roundId: openRound.id });
            }
          }}
          onSettle={(suggestion) => {
            void action("settle", {
              roundId: openRound?.id,
              senderId: suggestion.senderId,
              receiverId: suggestion.receiverId,
              amountPaise: suggestion.amountPaise,
            });
          }}
          onDifferent={(suggestion) => {
            setSelectedSuggestion(suggestion);
            setSelectedTransfer(undefined);
            setSheet("record");
          }}
          onSettlePending={(transfer) =>
            void action("settle-pending", { transferId: transfer.id })
          }
          onUndo={(transfer) =>
            void action("reverse", { transferId: transfer.id })
          }
          onPerson={(person) => {
            setSelectedPerson(person);
            setSheet("breakdown");
          }}
        />
      )}
      {view === "expenses" && (
        <ExpensesView
          data={data}
          syncCount={syncCount}
          filter={filter}
          setFilter={setFilter}
          onAdd={() => {
            setSelectedExpense(undefined);
            setSheet("expense");
          }}
          onOpen={(expense) => {
            setSelectedExpense(expense);
            setSheet("detail");
          }}
        />
      )}
      {view === "history" && <HistoryView data={data} />}{" "}
      {sheet === "expense" && (
        <ExpenseForm
          tripId={tripId}
          people={people}
          defaultPayerId={current}
          today={data.today}
          stayOptions={data.stayOptions || []}
          bikeOptions={data.bikeOptions || []}
          initial={selectedExpense}
          onClose={() => setSheet(null)}
          onSaved={() => {
            setSheet(null);
            setSelectedExpense(undefined);
            void load();
          }}
        />
      )}{" "}
      {sheet === "record" && selected && (
        <RecordSheet
          suggestion={selected}
          people={people}
          pending={pending}
          onClose={() => setSheet(null)}
          onSave={(amount) =>
            void action("settle", {
              roundId: openRound?.id,
              senderId: selected.senderId,
              receiverId: selected.receiverId,
              amountPaise: amount,
            })
          }
        />
      )}{" "}
      {sheet === "detail" && selectedExpense && (
        <ExpenseDetail
          expense={selectedExpense}
          people={people}
          onClose={() => setSheet(null)}
          onEdit={() => setSheet("expense")}
          onReverse={() => setSheet("reverse")}
        />
      )}{" "}
      {sheet === "reverse" && selectedExpense && (
        <ReverseSheet
          pending={pending}
          onClose={() => setSheet(null)}
          onConfirm={(reason) =>
            void action(
              "reverse",
              {
                expenseId: selectedExpense.id,
                reason,
                idempotencyKey: crypto.randomUUID(),
              },
              "money",
            )
          }
        />
      )}{" "}
      {sheet === "breakdown" && selectedPerson && (
        <PersonSheet
          person={selectedPerson}
          expenses={data.expenses}
          onClose={() => setSheet(null)}
        />
      )}{" "}
      {sheet === "info" && <InfoSheet onClose={() => setSheet(null)} />}
      {toast && (
        <div className="settlement-toast" role="status">
          Marked settled ·{" "}
          <button onClick={() => void action("reverse", { transferId: toast })}>
            Undo
          </button>
        </div>
      )}
    </section>
  );
}

function SettleView({
  data,
  openRound,
  pending,
  onAdd,
  onInfo,
  onStart,
  onFinish,
  onSettle,
  onDifferent,
  onSettlePending,
  onUndo,
  onPerson,
}: {
  data: MoneyData;
  openRound?: Round;
  pending: boolean;
  onAdd: () => void;
  onInfo: () => void;
  onStart: () => void;
  onFinish: () => void;
  onSettle: (item: Suggestion) => void;
  onDifferent: (item: Suggestion) => void;
  onSettlePending: (item: Transfer) => void;
  onUndo: (item: Transfer) => void;
  onPerson: (item: Person) => void;
}) {
  const people = data.balances;
  const current = data.currentUserId;
  const pos = position(people, current);
  const active = activeExpenses(data.expenses as never);
  const transfers = data.transfers || [];
  const late = lateExpenseCount(data.expenses as never, openRound as never);
  const totals = openRound
    ? roundTotals(openRound as never, transfers as never)
    : null;
  const net = pos.net;
  return (
    <div className="money-view">
      <header className={`position-hero ${net < 0 ? "owe" : "owed"}`}>
        {active.length === 0 ? (
          <>
            <span className="hero-icon">
              <Plus size={20} />
            </span>
            <h1>No expenses yet</h1>
            <p>Add one to start settling.</p>
            <button className="hub-primary" onClick={onAdd}>
              <Plus size={16} /> Add expense
            </button>
          </>
        ) : net > 0 ? (
          <>
            <span className="hero-icon">↗</span>
            <h1>
              You're owed <CountMoney amount={net} />
            </h1>
            <p>
              {pos.owedBy.length}{" "}
              {pos.owedBy.length === 1 ? "friend owes" : "friends owe"} you
            </p>
          </>
        ) : net < 0 ? (
          <>
            <span className="hero-icon">↘</span>
            <h1>
              You owe <CountMoney amount={Math.abs(net)} />
            </h1>
            <p>
              to{" "}
              {people.find((p) => p.netPaise > 0)?.name ||
                `${pos.owingTo.length} people`}
            </p>
          </>
        ) : (
          <>
            <span className="hero-icon">
              <Check size={20} />
            </span>
            <h1>You're all settled</h1>
            <p>No outstanding balances right now.</p>
          </>
        )}
      </header>
      {openRound && totals ? (
        <div className="round-strip money-hub-card">
          <div className="row-between">
            <div>
              <b>
                Round · started {formatDay(openRound.createdAt.slice(0, 10))}
              </b>
              <small>
                {formatMoney(totals.settled)} of {formatMoney(totals.total)}{" "}
                settled
              </small>
            </div>
            <button
              className="icon-button"
              onClick={onInfo}
              aria-label="What's a round?"
            >
              <Info size={17} />
            </button>
          </div>
          <div className="segmented-meter two-part">
            <i
              style={{
                width: `${totals.total ? (totals.settled / totals.total) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="meter-legend">
            <span>● Settled {formatMoney(totals.settled)}</span>
            <span>
              Still to pay{" "}
              {formatMoney(Math.max(0, totals.total - totals.settled))}
            </span>
          </div>
        </div>
      ) : (
        net !== 0 && (
          <div className="start-card money-hub-card">
            <button
              className="hub-primary"
              disabled={pending}
              onClick={onStart}
            >
              <CircleDollarSign size={17} /> Start settling
            </button>
            <button className="text-button" onClick={onInfo}>
              <Info size={15} /> What's a round?
            </button>
          </div>
        )
      )}
      {late > 0 && (
        <div className="late-banner money-hub-card">
          <CircleAlert size={18} />
          <span>
            {late} expense{late === 1 ? " was" : "s were"} added after this
            round started. They'll count in the next round.
          </span>
        </div>
      )}
      <section className="hub-section">
        <h2>Who pays whom</h2>
        {orderedTransfers(
          (data.suggestions || []) as never,
          transfers as never,
          current,
        ).map((item) => (
          <PaymentCard
            key={item.id || `${item.senderId}-${item.receiverId}-${item.kind}`}
            item={item as never}
            people={people}
            current={current}
            pending={pending}
            onSettle={onSettle}
            onDifferent={onDifferent}
            onSettlePending={onSettlePending}
            onUndo={onUndo}
          />
        ))}
      </section>
      <section className="hub-section">
        <h2>Everyone's balances</h2>
        <div className="balance-list money-hub-card">
          {people.map((person) => (
            <button
              className="balance-row"
              key={person.participantId}
              onClick={() => onPerson(person)}
            >
              <span className="avatar">{person.name.slice(0, 1)}</span>
              <span>
                <b>{person.participantId === current ? "You" : person.name}</b>
                <small>
                  Paid {formatMoney(person.paidPaise)} · Share{" "}
                  {formatMoney(person.sharePaise)}
                </small>
              </span>
              <strong
                className={
                  person.netPaise === 0
                    ? "settled-text"
                    : person.netPaise > 0
                      ? "owed-text"
                      : "owe-text"
                }
              >
                {person.netPaise === 0
                  ? "settled"
                  : person.netPaise > 0
                    ? `gets back ${formatMoney(person.netPaise)}`
                    : `owes ${formatMoney(Math.abs(person.netPaise))}`}
              </strong>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </section>
      {openRound && (
        <button className="finish-button" onClick={onFinish}>
          <Check size={15} /> Finish round
        </button>
      )}
    </div>
  );
}

function PaymentCard({
  item,
  people,
  current,
  pending,
  onSettle,
  onDifferent,
  onSettlePending,
  onUndo,
}: {
  item: {
    senderId: string;
    receiverId: string;
    amountPaise: number;
    kind: string;
    id?: string;
    confirmedAt?: string | null;
    confirmedBy?: string | null;
  };
  people: Person[];
  current: string;
  pending: boolean;
  onSettle: (item: Suggestion) => void;
  onDifferent: (item: Suggestion) => void;
  onSettlePending: (item: Transfer) => void;
  onUndo: (item: Transfer) => void;
}) {
  const sender =
    people.find((p) => p.participantId === item.senderId)?.name || "Someone";
  const receiver =
    people.find((p) => p.participantId === item.receiverId)?.name || "Someone";
  const label = (id: string, name: string) => (id === current ? "You" : name);
  const markedBy = item.confirmedBy
    ? people.find((person) => person.participantId === item.confirmedBy)
        ?.name || "a trip member"
    : "";
  return (
    <article className="payment-card money-hub-card">
      <div className="payment-route">
        <span className="avatar">{sender.slice(0, 1)}</span>
        <ArrowRight size={15} />
        <span className="avatar green-avatar">{receiver.slice(0, 1)}</span>
        <b>
          {label(item.senderId, sender)} → {label(item.receiverId, receiver)}
        </b>
      </div>
      <strong>{formatMoney(item.amountPaise)}</strong>
      {item.kind === "confirmed" ? (
        <small className="settled-meta">
          <Check size={13} /> Settled by {markedBy}{" "}
          {item.confirmedAt
            ? new Date(item.confirmedAt).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
              })
            : ""}
        </small>
      ) : item.kind === "pending" ? (
        <small>Not completed</small>
      ) : (
        <small>Suggested payment</small>
      )}
      {item.kind === "suggested" ? (
        <button
          className="hub-primary"
          disabled={pending}
          onClick={() =>
            onSettle({
              senderId: item.senderId,
              receiverId: item.receiverId,
              amountPaise: item.amountPaise,
            })
          }
        >
          <Check size={15} /> Mark settled
        </button>
      ) : item.kind === "pending" ? (
        <button
          className="hub-primary"
          disabled={pending}
          onClick={() => onSettlePending(item as unknown as Transfer)}
        >
          <Check size={15} /> Mark settled
        </button>
      ) : (
        <button
          className="text-button"
          onClick={() => onUndo(item as unknown as Transfer)}
        >
          <RotateCcw size={13} /> Undo
        </button>
      )}
      {item.kind === "suggested" && (
        <button
          className="text-button"
          onClick={() =>
            onDifferent({
              senderId: item.senderId,
              receiverId: item.receiverId,
              amountPaise: item.amountPaise,
            })
          }
        >
          Different amount
        </button>
      )}
    </article>
  );
}

function ExpensesView({
  data,
  syncCount,
  filter,
  setFilter,
  onAdd,
  onOpen,
}: {
  data: MoneyData;
  syncCount: number;
  filter: string;
  setFilter: (value: string) => void;
  onAdd: () => void;
  onOpen: (expense: Expense) => void;
}) {
  const grouped = groupExpenses(
    data.expenses.filter(
      (expense) => filter === "ALL" || expense.category === filter,
    ) as never,
  );
  const planned = data.budgetSummary.reduce(
    (sum, item) => sum + item.plannedPaise,
    0,
  );
  const spent = totalSpent(data.expenses as never);
  return (
    <div className="money-view">
      <div className="spend-summary">
        <div>
          <h1>{formatMoney(spent)} spent</h1>
          <p>
            of {formatMoney(planned)} planned ·{" "}
            <button className="budget-link">Budget →</button>
          </p>
        </div>
        <button className="hub-primary" onClick={onAdd}>
          <Plus size={16} /> Add expense
        </button>
      </div>
      <div className="spend-meter">
        <i
          style={{
            width: `${planned ? Math.min(100, (spent / planned) * 100) : 0}%`,
          }}
        />
      </div>
      <div className="category-chips" aria-label="Expense categories">
        {categories.map((category) => (
          <button
            key={category}
            className={filter === category ? "active" : ""}
            onClick={() => setFilter(category)}
          >
            {category === "ALL" ? "All" : labels[category]}
          </button>
        ))}
      </div>
      {Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, items]) => (
          <section className="expense-group" key={date}>
            <h2>{formatDay(date)}</h2>
            {items.map((expense) => (
              <button
                className={`expense-row money-hub-card ${expense.reversedAt ? "reversed" : ""}`}
                key={expense.id}
                onClick={() => onOpen(expense as Expense)}
              >
                <span className="category-icon">
                  {iconFor(expense.category)}
                </span>
                <span>
                  <b>
                    {expense.description ||
                      labels[expense.category] ||
                      expense.category}
                  </b>
                  <small>
                    Paid by{" "}
                    {data.balances.find(
                      (p) =>
                        p.participantId === expense.payments[0]?.participantId,
                    )?.name || "unknown"}{" "}
                    · {expense.shares.length} people
                  </small>
                </span>
                <strong>{formatMoney(expense.amountPaise)}</strong>
                {expense.reversedAt && <em>Reversed</em>}
                {syncCount > 0 && !expense.reversedAt && (
                  <i
                    className="pending-sync-dot"
                    title="Pending sync"
                    aria-label="Pending sync"
                  />
                )}
              </button>
            ))}
          </section>
        ))}
      {!Object.keys(grouped).length && <EmptyState onAdd={onAdd} />}
    </div>
  );
}

function HistoryView({ data }: { data: MoneyData }) {
  const names = new Map(data.balances.map((p) => [p.participantId, p.name]));
  const closedRounds = (data.rounds || []).filter(
    (round) => round.status !== "open",
  );
  return (
    <div className="money-view">
      <h1 className="view-title">Round history</h1>
      {closedRounds.map((round) => {
        const payments = (data.transfers || []).filter(
          (item) => item.roundId === round.id,
        );
        const settled = payments
          .filter((item) => item.status === "confirmed")
          .reduce((sum, item) => sum + item.amountPaise, 0);
        const summary = `Routivity settlement round\n${formatMoney(settled)} settled\n${payments.length} payments`;
        return (
          <details className="history-card money-hub-card" key={round.id}>
            <summary>
              <span>
                <b>
                  Round · Closed{" "}
                  {formatDay((round.closedAt || round.createdAt).slice(0, 10))}
                </b>
                <small>
                  {formatMoney(settled)} settled · {payments.length} payments
                </small>
              </span>
              <ArrowRight size={17} />
            </summary>
            {payments.map((payment) => (
              <div className="history-payment" key={payment.id}>
                <span>
                  {names.get(payment.senderId)} →{" "}
                  {names.get(payment.receiverId)}
                </span>
                <strong>{formatMoney(payment.amountPaise)}</strong>
              </div>
            ))}
            <button
              className="share-button"
              onClick={() => {
                if (navigator.share) void navigator.share({ text: summary });
                else void navigator.clipboard?.writeText(summary);
              }}
            >
              <Share2 size={15} /> Share summary
            </button>
          </details>
        );
      })}
      {closedRounds.length === 0 && (
        <p className="muted">No closed rounds yet.</p>
      )}
    </div>
  );
}

function RecordSheet({
  suggestion,
  people,
  pending,
  onClose,
  onSave,
}: {
  suggestion: Suggestion;
  people: Person[];
  pending: boolean;
  onClose: () => void;
  onSave: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(String(suggestion.amountPaise / 100));
  const paise = Math.round(Number(amount || 0) * 100);
  return (
    <Sheet title="Record payment" onClose={onClose}>
      <div className="record-route">
        <span className="avatar">
          {people
            .find((p) => p.participantId === suggestion.senderId)
            ?.name.slice(0, 1)}
        </span>
        <ArrowRight size={18} />
        <span className="avatar green-avatar">
          {people
            .find((p) => p.participantId === suggestion.receiverId)
            ?.name.slice(0, 1)}
        </span>
        <b>{formatMoney(paise)}</b>
      </div>
      <label className="sheet-field">
        Amount
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <p className="remaining">
        {formatMoney(Math.max(0, suggestion.amountPaise - paise))} remaining
        after this
      </p>
      <button
        className="hub-primary full"
        disabled={pending || paise <= 0 || paise > suggestion.amountPaise}
        onClick={() => onSave(paise)}
      >
        <Check size={16} /> Mark settled
      </button>
    </Sheet>
  );
}
function ReverseSheet({
  pending,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Sheet title="Reverse expense" onClose={onClose}>
      <p className="muted">Tell the group why this entry is being corrected.</p>
      <div className="reason-chips">
        {["Duplicate", "Wrong amount", "Other"].map((item) => (
          <button
            key={item}
            className={reason === item ? "selected" : ""}
            onClick={() => setReason(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <textarea
        aria-label="Reason"
        placeholder="Add a reason"
        value={
          reason === "Duplicate" || reason === "Wrong amount" ? "" : reason
        }
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        className="hub-primary full"
        disabled={pending || !reason.trim()}
        onClick={() => onConfirm(reason.trim())}
      >
        <RotateCcw size={16} /> Reverse expense
      </button>
    </Sheet>
  );
}
function ExpenseDetail({
  expense,
  people,
  onClose,
  onEdit,
  onReverse,
}: {
  expense: Expense;
  people: Person[];
  onClose: () => void;
  onEdit: () => void;
  onReverse: () => void;
}) {
  return (
    <Sheet
      title={expense.description || labels[expense.category] || "Expense"}
      onClose={onClose}
    >
      <div className="detail-amount">{formatMoney(expense.amountPaise)}</div>
      <p className="muted">
        {labels[expense.category]} · {formatDay(expense.expenseDate)}
      </p>
      {expense.reversedAt ? (
        <div className="late-banner">
          <RotateCcw size={16} /> Reversed
        </div>
      ) : (
        <>
          <p>
            Paid by{" "}
            {people.find(
              (p) => p.participantId === expense.payments[0]?.participantId,
            )?.name || "unknown"}
          </p>
          <div className="sheet-actions">
            <button className="hub-secondary" onClick={onEdit}>
              Edit
            </button>
            <button className="hub-secondary danger" onClick={onReverse}>
              Reverse expense
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
function PersonSheet({
  person,
  expenses,
  onClose,
}: {
  person: Person;
  expenses: Expense[];
  onClose: () => void;
}) {
  const paid = expenses.filter((expense) =>
    expense.payments.some(
      (item) => item.participantId === person.participantId,
    ),
  );
  return (
    <Sheet title={person.name} onClose={onClose}>
      <div className="detail-amount">
        {person.netPaise === 0
          ? "Settled"
          : person.netPaise > 0
            ? `gets back ${formatMoney(person.netPaise)}`
            : `owes ${formatMoney(Math.abs(person.netPaise))}`}
      </div>
      <p className="muted">
        Paid {formatMoney(person.paidPaise)} · Share{" "}
        {formatMoney(person.sharePaise)}
      </p>
      <h3>Expenses paid</h3>
      {paid.map((expense) => (
        <p key={expense.id}>
          {expense.description || labels[expense.category]}{" "}
          <strong>{formatMoney(expense.amountPaise)}</strong>
        </p>
      ))}
    </Sheet>
  );
}
function InfoSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="What's a round?" onClose={onClose}>
      <p>
        A round locks today's balances so everyone pays the same amounts.
        Expenses added after it starts roll into the next round.
      </p>
    </Sheet>
  );
}
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state">
      <WalletCards size={25} />
      <h2>No expenses yet</h2>
      <p>Add an expense to see who owes what.</p>
      <button className="hub-primary" onClick={onAdd}>
        <Plus size={16} /> Add expense
      </button>
    </div>
  );
}
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const first = sheetRef.current?.querySelector<HTMLElement>(
      "button, input, textarea, select",
    );
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab" && sheetRef.current) {
        const items = Array.from(
          sheetRef.current.querySelectorAll<HTMLElement>(
            "button, input, textarea, select, [tabindex]:not([tabindex='-1'])",
          ),
        ).filter((item) => !item.hasAttribute("disabled"));
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (
          items.length &&
          (index === -1 ||
            (event.shiftKey && index === 0) ||
            (!event.shiftKey && index === items.length - 1))
        ) {
          event.preventDefault();
          items[
            event.shiftKey
              ? index <= 0
                ? items.length - 1
                : index - 1
              : index === items.length - 1
                ? 0
                : index + 1
          ]?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="money-sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={sheetRef}
        className="money-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="money-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="sheet-handle" />
        <h2 id="money-sheet-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
