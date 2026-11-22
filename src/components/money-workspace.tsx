"use client";
/* eslint-disable react-hooks/purity */

import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import {
  rupeesToPaise,
  splitEqual,
  splitPercentBasisPoints,
} from "@/lib/money";
import { flushPendingMutations } from "@/lib/queue-sync";
import { queueMutation } from "@/lib/local-queue";

export type Person = {
  participantId: string;
  name: string;
  paidPaise: number;
  sharePaise: number;
  netPaise: number;
};
export type Expense = {
  id: string;
  description: string | null;
  category: string;
  expenseDate: string;
  amountPaise: number;
  reversedAt: string | null;
  version?: number;
  bikeId?: string | null;
  litres?: number | null;
  odometerKm?: number | null;
  payments: { participantId: string; amountPaise: number }[];
  shares: { participantId: string; amountPaise: number }[];
};
export type Budget = {
  id: string;
  category: string;
  ruleType: string;
  effectiveFrom: string;
  plannedPaise: number;
  actualPaise: number;
  status: string;
};
export type MoneyData = {
  expenses: Expense[];
  balances: Person[];
  budgetSummary: Budget[];
  currentUserId: string;
  today: string;
  stayOptions: { id: string; label: string }[];
  bikeOptions: { id: string; label: string }[];
  suggestions?: Suggestion[];
  rounds?: Round[];
  transfers?: Transfer[];
};
export type Suggestion = {
  senderId: string;
  receiverId: string;
  amountPaise: number;
};
export type Round = {
  id: string;
  status: string;
  createdAt: string;
  closedAt?: string | null;
  snapshot?: { participantId: string; netPaise: number }[];
};
export type Transfer = {
  id: string;
  roundId: string;
  senderId: string;
  receiverId: string;
  amountPaise: number;
  status: string;
  createdAt?: string;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  recordedBy?: string | null;
  reversalReason?: string | null;
};
const categories = [
  "FOOD",
  "STAY",
  "PRE_REQ",
  "FUEL",
  "PARKING_TOLLS",
  "EXPLORATION",
  "SHOPPING",
  "MISCELLANEOUS",
];
const categoryLabels: Record<string, string> = {
  FOOD: "Food",
  STAY: "Stay",
  PRE_REQ: "Pre Req",
  FUEL: "Fuel",
  PARKING_TOLLS: "Parking",
  EXPLORATION: "Tickets",
  SHOPPING: "Shopping",
  MISCELLANEOUS: "Custom",
};
function money(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function ExpenseForm({
  tripId,
  people,
  defaultPayerId,
  today,
  stayOptions,
  bikeOptions = [],
  initial,
  initialCategory,
  onClose,
  onSaved,
}: {
  tripId: string;
  people: Person[];
  defaultPayerId?: string;
  today?: string;
  stayOptions: { id: string; label: string }[];
  bikeOptions?: { id: string; label: string }[];
  initial?: Expense;
  initialCategory?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  void bikeOptions;
  const payer = defaultPayerId || people[0]?.participantId || "";
  const [amount, setAmount] = useState(
    initial ? (initial.amountPaise / 100).toFixed(2) : "",
  );
  const [description, setDescription] = useState(initial?.description || "");
  const [category, setCategory] = useState(
    initial?.category || initialCategory || "FOOD",
  );
  const [date, setDate] = useState(
    initial?.expenseDate || today || new Date().toISOString().slice(0, 10),
  );
  const [activityId, setActivityId] = useState("");
  const [litres, setLitres] = useState("");
  const [odometer, setOdometer] = useState("");
  const [split, setSplit] = useState<"equal" | "exact" | "percent">("equal");
  const [payerRows, setPayerRows] = useState(
    initial?.payments.map((item) => ({
      participantId: item.participantId,
      amount: (item.amountPaise / 100).toFixed(2),
    })) || [
      {
        participantId: payer,
        amount: initial ? (initial.amountPaise / 100).toFixed(2) : "",
      },
    ],
  );
  const [selected, setSelected] = useState<string[]>(() => {
    if (initial) return initial.shares.map((item) => item.participantId);
    return payer ? [payer] : [];
  });
  const [custom, setCustom] = useState<Record<string, string>>(
    Object.fromEntries(
      (initial?.shares || []).map((item) => [
        item.participantId,
        (item.amountPaise / 100).toFixed(2),
      ]),
    ),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [stayOpen, setStayOpen] = useState(false);
  const stayMenuRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(false);

  useLayoutEffect(() => {
    const backdrop = backdropRef.current;
    const dim = dimRef.current;
    const sheet = sheetRef.current;
    if (!backdrop || !dim || !sheet) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    const context = gsap.context(() => {
      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
      timeline
        .fromTo(
          dim,
          { opacity: 0 },
          { opacity: 1, duration: 0.32, ease: "power2.out" },
        )
        .fromTo(
          sheet,
          { opacity: 0, y: 34, scale: 0.965, filter: "blur(6px)" },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 0.58,
            ease: "back.out(1.35)",
          },
          "-=0.12",
        )
        .fromTo(
          sheet.querySelector(".sheet-title"),
          { opacity: 0, y: -10 },
          { opacity: 1, y: 0, duration: 0.28 },
          "-=0.27",
        )
        .fromTo(
          sheet.querySelector(".amount-input"),
          { opacity: 0, y: 14, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.3 },
          "-=0.14",
        )
        .fromTo(
          sheet.querySelectorAll(".category-card"),
          { opacity: 0, y: 12, scale: 0.92 },
          { opacity: 1, y: 0, scale: 1, duration: 0.32, stagger: 0.035 },
          "-=0.15",
        )
        .fromTo(
          sheet.querySelectorAll(
            ".expense-fields, .stay-options, .fuel-fields, .payer-heading, .payer-row, .split-heading, .person-split",
          ),
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.3, stagger: 0.035 },
          "-=0.16",
        )
        .fromTo(
          sheet.querySelector(".expense-sheet-footer"),
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.28 },
          "-=0.12",
        );
    }, sheet);
    return () => context.revert();
  }, []);

  useEffect(() => {
    if (!stayOpen) return;
    function closeMenu(event: MouseEvent) {
      if (!stayMenuRef.current?.contains(event.target as Node))
        setStayOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setStayOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [stayOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const items = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          "button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
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
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleClose() {
    if (closeTimer.current) return;
    closeTimer.current = true;
    const backdrop = backdropRef.current;
    const dim = dimRef.current;
    const sheet = sheetRef.current;
    if (
      !backdrop ||
      !dim ||
      !sheet ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      onClose();
      return;
    }
    setClosing(true);
    gsap
      .timeline({ onComplete: onClose })
      .to(sheet, {
        opacity: 0,
        y: 24,
        scale: 0.98,
        filter: "blur(4px)",
        duration: 0.25,
        ease: "power2.in",
      })
      .to(dim, { opacity: 0, duration: 0.2, ease: "power2.in" }, "-=0.1");
  }

  function handleAmountChange(val: string) {
    setAmount(val);
    // Keep payer row amount in sync only when there's a single payer (can still be manually overridden)
    setPayerRows((rows) => {
      if (rows.length === 1) return [{ ...rows[0], amount: val }];
      return rows;
    });
  }

  function handlePayerChange(index: number, newPayerId: string) {
    setPayerRows((rows) => {
      const updated = rows.map((item, rowIndex) =>
        rowIndex === index ? { ...item, participantId: newPayerId } : item,
      );
      // Keep selected in sync with the full set of current payer IDs
      setSelected(updated.map((r) => r.participantId));
      return updated;
    });
  }

  function handleAddPayer() {
    const nextPerson =
      people.find(
        (p) => !payerRows.some((r) => r.participantId === p.participantId),
      ) || people[0];
    if (!nextPerson) return;
    setPayerRows((rows) => {
      const updated = [
        ...rows,
        { participantId: nextPerson.participantId, amount: "" },
      ];
      setSelected(updated.map((r) => r.participantId));
      return updated;
    });
  }

  const amountPaise = amount ? Math.round(Number(amount) * 100) : 0;
  const equal = selected.length
    ? splitEqual(amountPaise as never, selected)
    : {};
  const percentages = Object.fromEntries(
    selected.map((id) => [id, Math.round(Number(custom[id] || 0) * 100)]),
  );
  const percentageTotal = Object.values(percentages).reduce(
    (sum, item) => sum + item,
    0,
  );
  const percent =
    percentageTotal === 10000
      ? splitPercentBasisPoints(amountPaise as never, percentages)
      : {};
  const shares = people
    .filter((person) => selected.includes(person.participantId))
    .map((person) => ({
      participantId: person.participantId,
      amountPaise: Number(
        split === "equal"
          ? equal[person.participantId] || 0
          : split === "percent"
            ? percent[person.participantId] || 0
            : (() => {
                try {
                  return rupeesToPaise(custom[person.participantId] || 0);
                } catch {
                  return 0;
                }
              })(),
      ),
    }));
  const assigned = shares.reduce((sum, item) => sum + item.amountPaise, 0);
  const payments = payerRows.map((item) => ({
    participantId: item.participantId,
    amountPaise: Math.round(Number(item.amount || 0) * 100),
  }));
  const paid = payments.reduce((sum, item) => sum + item.amountPaise, 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!amountPaise || !selected.length)
      return setError("Enter an amount and select at least one person.");
    if (assigned !== amountPaise)
      return setError(`Shares must equal ${money(amountPaise)}.`);
    if (paid !== amountPaise)
      return setError(`Payments must equal ${money(amountPaise)}.`);
    const payload = {
      tripId,
      idempotencyKey: crypto.randomUUID(),
      amountPaise,
      description,
      category,
      expenseDate: date,
      activityId: category === "STAY" ? activityId || undefined : undefined,
      litresMilli:
        category === "FUEL" && litres
          ? Math.round(Number(litres) * 1000)
          : undefined,
      odometerKmMilli:
        category === "FUEL" && odometer
          ? Math.round(Number(odometer) * 1000)
          : undefined,
      payments,
      shares,
    };
    setPending(true);
    await queueMutation({
      id: payload.idempotencyKey,
      tripId,
      type: initial ? "edit-expense" : "create-expense",
      payload: initial
        ? { expenseId: initial.id, ...payload, change: payload }
        : payload,
      createdAt: Date.now(),
    });
    const result = await flushPendingMutations();
    setPending(false);
    if (result[0]?.error) return setError(result[0].error);
    onSaved();
  }

  return (
    <div
      className={closing ? "sheet-backdrop is-closing" : "sheet-backdrop"}
      ref={backdropRef}
      onClick={handleClose}
    >
      <div className="sheet-dim" ref={dimRef} aria-hidden="true" />
      <div
        className="expense-sheet"
        ref={sheetRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-title">
          <div>
            {initial && <span className="section-label">EDIT EXPENSE</span>}
            <h2>Enter the amount</h2>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit}>
          <input
            className="amount-input"
            inputMode="decimal"
            autoFocus
            placeholder="₹ 0.00"
            value={amount}
            onChange={(event) => handleAmountChange(event.target.value)}
          />
          <div className="category-grid">
            {categories.map((item) => (
              <button
                type="button"
                className={`category-card category-${item.toLowerCase()}${category === item ? " selected" : ""}`}
                key={item}
                onClick={() => setCategory(item)}
              >
                {categoryLabels[item]}
                {category === item && (
                  <span className="category-check" aria-hidden="true">
                    <Check size={11} strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="expense-fields">
            <input
              placeholder="What was it for? (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <input
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          {category === "STAY" && stayOptions.length > 0 && (
            <div className="stay-options">
              <span className="field-label">Link this stay</span>
              <div
                className={stayOpen ? "stay-dropdown open" : "stay-dropdown"}
                ref={stayMenuRef}
              >
                <button
                  type="button"
                  className="stay-select"
                  aria-haspopup="listbox"
                  aria-expanded={stayOpen}
                  onClick={() => setStayOpen((open) => !open)}
                >
                  <span>
                    {stayOptions.find((stay) => stay.id === activityId)
                      ?.label || "Choose a stay…"}
                  </span>
                  <ChevronDown size={14} />
                </button>
                {stayOpen && (
                  <div className="stay-menu" role="listbox">
                    {stayOptions.map((stay) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={activityId === stay.id}
                        className={
                          activityId === stay.id
                            ? "stay-option selected"
                            : "stay-option"
                        }
                        key={stay.id}
                        onClick={() => {
                          setActivityId(stay.id);
                          if (!description) setDescription(stay.label);
                          setStayOpen(false);
                        }}
                      >
                        {stay.label}
                        {activityId === stay.id && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {category === "FUEL" && (
            <div className="fuel-fields">
              <input
                type="number"
                min="0"
                step="0.001"
                placeholder="Litres (optional)"
                value={litres}
                onChange={(event) => setLitres(event.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.001"
                placeholder="Odometer km (optional)"
                value={odometer}
                onChange={(event) => setOdometer(event.target.value)}
              />
            </div>
          )}
          <div className="payer-heading">
            <span className="field-label">Paid by</span>
            <button
              type="button"
              className="small-button"
              onClick={handleAddPayer}
            >
              <Plus size={12} /> Add payer
            </button>
          </div>
          {payerRows.map((row, index) => (
            <div className="payer-row" key={index}>
              <select
                value={row.participantId}
                onChange={(event) =>
                  handlePayerChange(index, event.target.value)
                }
              >
                {people.map((person) => (
                  <option
                    key={person.participantId}
                    value={person.participantId}
                  >
                    {person.name}
                    {person.participantId === payer ? " (you)" : ""}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="₹ paid"
                value={row.amount}
                onChange={(event) =>
                  setPayerRows((rows) =>
                    rows.map((item, rowIndex) =>
                      rowIndex === index
                        ? { ...item, amount: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </div>
          ))}
          <div className="split-heading">
            <span className="field-label">Shared by</span>
            <select
              value={split}
              onChange={(event) => setSplit(event.target.value as typeof split)}
            >
              <option value="equal">Equal</option>
              <option value="exact">Exact amounts</option>
              <option value="percent">Percentages</option>
            </select>
          </div>
          {people.map((person) => (
            <label className="person-split" key={person.participantId}>
              <input
                type="checkbox"
                checked={selected.includes(person.participantId)}
                onChange={() =>
                  setSelected((current) =>
                    current.includes(person.participantId)
                      ? current.filter((id) => id !== person.participantId)
                      : [...current, person.participantId],
                  )
                }
              />
              <span>{person.name}</span>
              {split !== "equal" && (
                <input
                  className="split-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={split === "percent" ? "%" : "₹"}
                  value={custom[person.participantId] || ""}
                  onChange={(event) =>
                    setCustom((current) => ({
                      ...current,
                      [person.participantId]: event.target.value,
                    }))
                  }
                />
              )}
            </label>
          ))}
          <div className="expense-sheet-footer">
            {error && <div className="money-error">{error}</div>}
            <button className="expense-save-button" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
