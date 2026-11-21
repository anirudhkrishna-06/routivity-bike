export type Membership = { tripId: string; userId: string; status: "active" | "inactive"; role: "owner" | "member" };
export function assertTripMember(membership: Membership | null | undefined, tripId: string) {
  if (!membership || membership.tripId !== tripId || membership.status !== "active") throw new Error("You are not an active member of this trip");
  return membership;
}
