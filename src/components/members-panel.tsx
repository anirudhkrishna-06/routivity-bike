"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Member = { id: string; name: string; email?: string | null; status: string; role: string; userId?: string | null };
export function MembersPanel({ tripId }: { tripId: string }) {
  const [members, setMembers] = useState<Member[]>([]); const [invite, setInvite] = useState(""); const [name, setName] = useState(""); const [error, setError] = useState(""); const [inviteUrl, setInviteUrl] = useState("");
  const load = useCallback(async () => { const response = await fetch(`/api/trips/${tripId}/members`); const body = await response.json() as { members?: Member[]; error?: string }; if (response.ok) setMembers(body.members || []); else setError(body.error || "Unable to load members."); }, [tripId]);
  // Fetching external member state is the purpose of this effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function submit(event: FormEvent) { event.preventDefault(); const response = await fetch(`/api/trips/${tripId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email: invite }) }); const body = await response.json() as { inviteUrl?: string; error?: string }; if (!response.ok) setError(body.error || "Unable to create invite."); else { setInviteUrl(window.location.origin + body.inviteUrl); setName(""); setInvite(""); void load(); } }
  return <main className="members-page"><div className="members-card"><Image src="/logo.png" alt="Routivity" width={150} height={54}/><span className="section-label">TRIP MEMBERS</span><h1>People on this ride</h1><p>Participants can be part of the trip even before they create an account.</p><div className="member-list">{members.map((member) => <div className="member-line" key={member.id}><span>{member.name.slice(0, 2).toUpperCase()}</span><div><b>{member.name}</b><small>{member.email || "No email yet"}</small></div><em>{member.userId ? "joined" : "invite pending"}</em></div>)}</div><form className="invite-form" onSubmit={submit}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Participant name" required/><input value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="Email address (optional)" type="email"/><button>Invite</button></form>{inviteUrl && <div className="invite-result">Copy this secure, single-use invite link:<input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()}/></div>}{error && <div className="auth-error">{error}</div>}</div></main>;
}
