"use client";

import { useEffect, useState } from "react";
import { ExpenseForm, type MoneyData } from "./money-workspace";
import { LoadingScreen } from "./loading-screen";

function cachedMoney(tripId: string) {
  if (typeof window === "undefined") return null;
  try {
    const cached = window.localStorage.getItem(`routivity-money-${tripId}`);
    return cached ? (JSON.parse(cached) as MoneyData) : null;
  } catch {
    return null;
  }
}

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
  const [data, setData] = useState<MoneyData | null>(() => cachedMoney(tripId));
  const [loading, setLoading] = useState(() => !cachedMoney(tripId));
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    const cacheKey = `routivity-money-${tripId}`;

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
          <LoadingScreen inline label="Loading expenses" />
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
