"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Bell, CalendarDays, ChevronRight, CircleDollarSign, Home, LogOut, Plus, Settings2, Users, WalletCards } from "lucide-react";
import { ItineraryWorkspace } from "./itinerary-workspace";

type Trip = { id: string; name: string; startDate: string; endDate: string; currency: string; timezone: string };
type Props = { user: { name: string; email: string }; trips: Trip[]; initialTripId?: string };

const tabs = [
  { label: "Home", icon: Home },
  { label: "Itinerary", icon: CalendarDays },
  { label: "Expenses", icon: WalletCards },
  { label: "Settle", icon: CircleDollarSign },
  { label: "Activity", icon: Activity },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00"));
}

export function AppShell({ user, trips, initialTripId }: Props) {
  const router = useRouter();
  const [active, setActive] = useState("Home");
  const [dark, setDark] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(initialTripId && trips.some((trip) => trip.id === initialTripId) ? initialTripId : trips[0]?.id);
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? trips[0];

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
  }

  if (!selectedTrip) {
    return <main className={dark ? "app dark" : "app"}><div className="app-frame"><header className="topbar"><Image src="/logo.png" alt="Routivity" width={146} height={53} priority/><button className="avatar" onClick={() => void signOut()} title="Sign out">{user.name.slice(0, 2).toUpperCase()}</button></header><section className="empty-trip"><span className="empty-icon"><CalendarDays size={25}/></span><span className="section-label">YOUR TRIPS</span><h1>Start with a blank page.</h1><p>Nothing is preloaded. Create a trip or import your itinerary CSV to get started.</p><div className="empty-actions"><Link className="primary-button" href="/trips/new"><Plus size={17}/> Create a trip</Link><Link className="ghost-button" href="/sign-in"><LogOut size={16}/> Sign out</Link></div></section></div><button className="theme-toggle" onClick={() => setDark(!dark)} aria-label="Toggle theme"><Settings2 size={16}/></button></main>;
  }

  return <main className={dark ? "app dark" : "app"}><div className="app-frame">
    <header className="topbar"><Image src="/logo.png" alt="Routivity" width={146} height={53} priority/><label className="trip-picker"><span>ACTIVE TRIP</span><select value={selectedTrip.id} onChange={(event) => setSelectedTripId(event.target.value)}>{trips.map((trip) => <option value={trip.id} key={trip.id}>{trip.name}</option>)}</select></label><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18}/></button><button className="avatar" onClick={() => void signOut()} title="Sign out">{user.name.slice(0, 2).toUpperCase()}</button></div></header>
    {active === "Itinerary" ? <ItineraryWorkspace tripId={selectedTrip.id} /> : <section className="real-dashboard"><div className="eyebrow"><span className="live-dot"/> {user.name}’s trip space</div><h1>{selectedTrip.name}</h1><p className="hero-copy">{formatDate(selectedTrip.startDate)} — {formatDate(selectedTrip.endDate)} · {selectedTrip.timezone}</p><div className="hero-actions"><button className="primary-button" onClick={() => setActive("Itinerary")}><CalendarDays size={17}/> Open itinerary</button><Link className="ghost-button" href={"/trip/" + selectedTrip.id + "/members"}><Users size={16}/> Members</Link></div><div className="real-grid"><article><CalendarDays size={19}/><span>ITINERARY</span><strong>Nothing planned yet</strong><small>Import a CSV or add your first activity.</small></article><article><WalletCards size={19}/><span>EXPENSES</span><strong>No expenses yet</strong><small>Expense tracking will appear here.</small></article><article><Activity size={19}/><span>ACTIVITY LOG</span><strong>Ready when you are</strong><small><Link href={"/trip/" + selectedTrip.id + "/activity"}>View trip changes <ChevronRight size={13}/></Link></small></article></div></section>}
    <nav className="bottom-nav">{tabs.map(({ label, icon: Icon }) => <button key={label} className={active === label ? "nav-item active" : "nav-item"} onClick={() => setActive(label)}><Icon size={20}/><span>{label}</span></button>)}<button className="fab" onClick={() => setActive("Itinerary")} aria-label="Open itinerary"><Plus size={25}/></button></nav>
  </div><button className="theme-toggle" onClick={() => setDark(!dark)} aria-label="Toggle theme"><Settings2 size={16}/></button></main>;
}

