import { Suspense } from "react";
import { JoinTrip } from "@/components/join-trip";
export default function JoinPage() { return <Suspense fallback={<main className="auth-page"><div className="auth-card">Loading join page…</div></main>}><JoinTrip /></Suspense>; }
