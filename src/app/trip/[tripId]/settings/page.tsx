import Link from "next/link";
import { SettingsPanel } from "@/components/settings-panel";

export const instant = false;

export default async function TripSettingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <main className="settings-page"><div className="settings-frame"><Link className="back-link" href={`/?trip=${tripId}`}>← Back to trips</Link><h1>Manage this trip</h1><SettingsPanel tripId={tripId}/></div></main>;
}
