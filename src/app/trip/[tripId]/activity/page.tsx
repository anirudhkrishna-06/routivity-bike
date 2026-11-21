import { ActivityLog } from "@/components/activity-log";
export const instant = false;
export default async function ActivityPage({ params }: { params: Promise<{ tripId: string }> }) { const { tripId } = await params; return <ActivityLog tripId={tripId} />; }
