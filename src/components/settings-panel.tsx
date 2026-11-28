"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  GitMerge,
  Trash2,
  Users,
  WifiOff,
} from "lucide-react";
import { OfflineQueuePanel } from "./offline-queue-panel";
import { ExportCenter } from "./export-center";
import { ConflictCentre } from "./conflict-centre";
import { MembersPanel } from "./members-panel";
import { TripWatchSettings } from "./trip-watch/trip-watch-settings";

export function SettingsPanel({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function remove() {
    if (
      !window.confirm(
        "Delete this trip, its itinerary, members, expenses, budgets, and settlements for everyone? This cannot be undone."
      )
    ) {
      return;
    }
    setPending(true);
    const response = await fetch(`/api/trips/${tripId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Deleted from trip settings" }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) setError(body.error || "Unable to delete this trip.");
    else router.push("/");
    setPending(false);
  }

  return (
    <div className="settings-shell">
      

      <div className="settings-stack"><div className="settings-module settings-stagger" style={{ "--i": 1 } as React.CSSProperties}>
          
          <MembersPanel tripId={tripId} />
        </div>

        <div className="settings-module settings-stagger" style={{ "--i": 2 } as React.CSSProperties}>
          <TripWatchSettings tripId={tripId} />
        </div>

        <div className="settings-module settings-stagger" style={{ "--i": 3 } as React.CSSProperties}>
          
          <OfflineQueuePanel />
        </div>

        <div className="settings-module settings-stagger" style={{ "--i": 4 } as React.CSSProperties}>
          
          <ConflictCentre tripId={tripId} />
        </div>

        <div className="settings-module settings-stagger" style={{ "--i": 5 } as React.CSSProperties}>
          
          <ExportCenter tripId={tripId} />
        </div>

        <section
          className="settings-card settings-danger-zone settings-stagger"
          style={{ "--i": 6 } as React.CSSProperties}
        >
          <div className="settings-card-head">
            <span className="settings-icon-badge danger">
              <AlertTriangle size={17} />
            </span>
            <div className="settings-card-title">
              <h3>Delete trip</h3>
              <p>
                Removes the shared trip from every member account, including its itinerary,
                financial records, budgets, and settlement history.
              </p>
            </div>
          </div>

          {error && (
            <div className="money-error settings-error-banner" role="alert">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="settings-danger-footer">
            <button
              type="button"
              className="danger-button"
              disabled={pending}
              onClick={() => void remove()}
            >
              <Trash2 size={15} />
              <span>{pending ? "Deleting…" : "Delete this trip for everyone"}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

