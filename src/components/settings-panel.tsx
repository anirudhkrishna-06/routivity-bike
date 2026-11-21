"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SettingsPanel({ tripId }: { tripId: string }) {
  const router = useRouter(); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function remove() { if (!window.confirm("Delete this trip, its itinerary, members, expenses, budgets, and settlements for everyone? This cannot be undone.")) return; setPending(true); const response = await fetch(`/api/trips/${tripId}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Deleted from trip settings" }) }); const body = await response.json() as { error?: string }; if (!response.ok) setError(body.error || "Unable to delete this trip."); else router.push("/"); setPending(false); }
  return <div className="settings-card"><div><strong>Delete trip</strong><p>Removes the shared trip from every member account, including its itinerary, financial records, budgets, and settlement history.</p></div>{error && <div className="money-error">{error}</div>}<button className="danger-button" disabled={pending} onClick={() => void remove()}>{pending ? "Deleting…" : "Delete this trip for everyone"}</button></div>;
}
