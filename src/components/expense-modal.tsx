"use client";

import { useEffect, useState } from "react";
import { ExpenseForm, type MoneyData } from "./money-workspace";

export function ExpenseModal({
  tripId,
  initialCategory,
  onClose,
  onSaved,
}: {
  tripId: string;
  initialCategory?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<MoneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    const cacheKey = `routivity-money-${tripId}`;
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as MoneyData;
        setData(parsed);
        setLoading(false);
      }
    } catch {}

    fetch(`/api/trips/${tripId}/money`)
      .then(async (res) => {
        const body = (await res.json()) as MoneyData & { error?: string };
        if (!isCurrent) return;
        if (!res.ok || body.error) {
          setError(body.error || "Unable to load expense data.");
        } else {
          setData(body);
          setError("");
          try {
            window.localStorage.setItem(cacheKey, JSON.stringify(body));
          } catch {}
        }
      })
      .catch((err) => {
        if (!isCurrent) return;
        if (!data) setError(err instanceof Error ? err.message : "Unable to load expense data.");
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [tripId]);

  if (loading && !data) {
    return (
      <div className="sheet-backdrop" onClick={onClose}>
        <div
          className="expense-sheet"
          onClick={(event) => event.stopPropagation()}
          style={{ minHeight: "180px", display: "grid", placeItems: "center" }}
        >
          <p style={{ color: "#778178", fontSize: "13px" }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="sheet-backdrop" onClick={onClose}>
        <div className="expense-sheet" onClick={(event) => event.stopPropagation()}>
          <div className="sheet-title">
            <h2>Error</h2>
            <button type="button" className="close-button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="money-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <ExpenseForm
      tripId={tripId}
      people={data.balances}
      defaultPayerId={data.currentUserId}
      today={data.today}
      stayOptions={data.stayOptions || []}
      bikeOptions={data.bikeOptions || []}
      initialCategory={initialCategory}
      onClose={onClose}
      onSaved={() => {
        onSaved?.();
      }}
    />
  );
}
