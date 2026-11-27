import { Suspense } from "react";
import { JoinTrip } from "@/components/join-trip";
import { LoadingScreen } from "@/components/loading-screen";

export default function JoinPage() { return <Suspense fallback={<main className="auth-page"><LoadingScreen inline label="Opening join page" /></main>}><JoinTrip /></Suspense>; }
