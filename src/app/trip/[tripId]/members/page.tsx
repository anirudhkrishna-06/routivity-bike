import { MembersPanel } from "@/components/members-panel";

export const instant = false;

export default async function MembersPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <MembersPanel tripId={tripId} />;
}
