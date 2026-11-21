import Link from "next/link";
import { SettingsPanel } from "@/components/settings-panel";

export const instant = false;

export default async function TripSettingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <main className="settings-page"><div className="settings-frame"><Link className="back-link" href={`/?trip=${tripId}`}>← Back to trips</Link><span className="section-label">TRIP SETTINGS</span><h1>Manage this trip</h1><p>Settings affect every member connected to this shared trip.</p><SettingsPanel tripId={tripId}/></div></main>;
}
