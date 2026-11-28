"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, CalendarDays, CircleDollarSign, LogOut, Plus, UserRound, WalletCards } from "lucide-react";
import gsap from "gsap";
import { ItineraryWorkspace } from "./itinerary-workspace";
import { ItineraryTools } from "./scheduling-panel";
import { FuelIntelligence } from "./fuel-intelligence";
import { MoneySettlementWorkspace } from "./money-settlement-workspace";
import { BudgetWorkspace } from "./budget-workspace";
import { AnalyticsWorkspace } from "./analytics-workspace";
import { TripNowDashboard } from "./trip-now-dashboard";
import { LoadingScreen } from "./loading-screen";
import { ExpenseModal } from "./expense-modal";
import { preloadBikeLoader } from "./bike-loader";
type Trip = { id: string; name: string; startDate: string; endDate: string; currency: string; timezone: string };
type Props = { user: { name: string; email: string }; trips: Trip[]; initialTripId?: string; initialView?: "Analytics" };
const SchedulingPanel = ItineraryTools;
const tabs = [{ label: "Itinerary", icon: CalendarDays }, { label: "Budget", icon: WalletCards }, { label: "Settlements", icon: CircleDollarSign }, { label: "Analytics", icon: BarChart3 }];
function date(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00")); }
function tripStatus(trip: Trip) { const today = new Date().toISOString().slice(0, 10); return today < trip.startDate ? "UPCOMING" : today > trip.endDate ? "PAST" : "ACTIVE"; }
export function AppShell({ user, trips, initialTripId, initialView }: Props) {
  const router = useRouter();
  const [active, setActive] = useState(initialView || "Trip Now");
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(initialTripId && trips.some((trip) => trip.id === initialTripId) ? initialTripId : undefined);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<string | undefined>();
  const hubRef = useRef<HTMLElement>(null);
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId);

  useEffect(() => {
    if (selectedTrip || !hubRef.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduced) { gsap.set(".hub-entrance", { opacity: 1, y: 0 }); return; }
      gsap.fromTo(".hub-entrance", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.65, stagger: 0.08, ease: "power3.out" });
      gsap.to(".hub-route", { strokeDashoffset: -180, duration: 20, repeat: -1, ease: "none" });
      gsap.to(".hub-contour, .hub-orb", { y: 10, rotation: 1.2, duration: 9, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: 0.15 });
      gsap.to(".hub-waypoint", { scale: 1.35, opacity: 0.9, duration: 2.4, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: 0.4 });
    }, hubRef);
    return () => ctx.revert();
  }, [selectedTrip]);

  useEffect(() => {
    preloadBikeLoader();
    document.documentElement.dataset.theme = "light";
    window.localStorage.removeItem("routivity-theme");
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
  }

  function selectTrip(id: string) {
    setLoading(true);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `/?trip=${id}`);
    window.setTimeout(() => {
      setSelectedTripId(id);
      setActive("Trip Now");
      setLoading(false);
    }, 420);
  }

  function go(label: string) {
    if (!selectedTrip) return;
    setLoading(true);
    window.setTimeout(() => {
      setActive(label);
      setLoading(false);
    }, 260);
  }

  function triggerHaptic() {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate?.(22);
      } catch {}
    }
  }

  function openExpenses(category?: string) {
    triggerHaptic();
    setExpenseCategory(category);
    setExpenseModalOpen(true);
  }

  function goToAllTrips() {
    setLoading(true);
    if (typeof window !== "undefined") window.history.replaceState(null, "", "/");
    window.setTimeout(() => {
      setSelectedTripId(undefined);
      setActive("Trip Now");
      setLoading(false);
    }, 260);
  }

  function goToTripNow() {
    if (active === "Trip Now") { goToAllTrips(); return; }
    go("Trip Now");
  }

  return (
    <main className={`app${selectedTrip ? "" : " all-trips"}`}>
      <div className="app-frame">
        <header className="topbar">
          {selectedTrip && (
            <button
              className="topbar-back"
              onClick={goToTripNow}
              aria-label={active === "Trip Now" ? "Back to all trips" : "Back to Trip Now dashboard"}
              title={active === "Trip Now" ? "Back to all trips" : "Back to Trip Now dashboard"}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          {selectedTrip && <button className="brand-home" onClick={goToAllTrips} aria-label="Back to all trips">
            <Image
              src="/logo.png"
              alt="Routivity"
              width={112}
              height={41}
              priority
            />
          </button>}
          <div className="top-actions">
            <button
              className={selectedTrip ? "avatar" : "avatar hub-avatar"}
              onClick={() => setProfileOpen((open) => !open)}
              aria-label="Open profile menu"
            >
              {selectedTrip ? user.name.slice(0, 2).toUpperCase() : <UserRound size={18} strokeWidth={1.8} />}
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <button onClick={() => void signOut()}>
                  <LogOut size={12} /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        {!selectedTrip ? (
          <section className="trip-hub all-trips-hub" ref={hubRef}>
            <div className="hub-ambient" aria-hidden="true">
              <span className="hub-orb hub-orb-warm" /><span className="hub-orb hub-orb-sage" />
              <svg className="hub-map" viewBox="0 0 760 700" preserveAspectRatio="none">
                <g className="hub-contours"><path d="M20 145c92-66 151-12 192 31s82 44 121 4" /><path d="M20 166c89-61 142-11 184 30s87 50 130 5" /><path d="M20 188c83-52 132-11 177 29s90 51 139 8" /><path d="M520 505c71-70 117-32 151 7s55 43 91 15" /></g>
                <path className="hub-route" d="M-20 387 C 140 510, 208 452, 300 330 S 475 125, 780 237" />
                <g className="hub-crosshairs"><path d="M54 195h12m-6-6v12M704 190h12m-6-6v12M61 530h12m-6-6v12M688 498h12m-6-6v12M380 146h12m-6-6v12" /></g>
                <g className="hub-waypoints"><circle cx="216" cy="452" r="3" /><circle cx="552" cy="164" r="3" /></g>
              </svg>
            </div>
            <div className="hub-hero hub-entrance">
              <Image className="hub-hero-logo" src="/logo.png" alt="routivity.ai" width={420} height={152} priority />
            </div>
            <div className="hub-action-grid">
              <Link className="hub-action-card add hub-entrance" href="/trips/new"><i><Plus size={15}/></i><span><b>ADD</b></span></Link>
              <Link className="hub-action-card join hub-entrance" href="/join"><i><ArrowLeft size={15}/></i><span><b>JOIN</b></span></Link>
            </div>
            {trips.length === 0 ? (
              <div className="empty-trip">
                <CalendarDays size={26} />
                <h2>No trips yet</h2>
                <p>Create your first trip from a filled CSV template.</p>
                <Link className="primary-button" href="/trips/new">
                  Create a trip
                </Link>
              </div>
            ) : (
              <div className="trip-card-grid">
                {trips.map((trip) => {
                  const status = tripStatus(trip);
                  return (
                    <article className="trip-hub-card hub-entrance" key={trip.id}>
                      <svg className="trip-card-watermark" viewBox="0 0 150 110" aria-hidden="true"><path d="M-12 71c33-42 68-31 84-6s32 30 78-12" /><path d="M-8 89c35-42 64-26 81-2s36 27 80-11" /></svg>
                      <div className="trip-card-line">
                        <span className={`trip-status ${status.toLowerCase()}`}><b />{status}</span>
                      </div>
                      <h2>{trip.name}</h2>
                      <div className="trip-card-footer">
                      <p>
                        <CalendarDays size={14} /> {date(trip.startDate)} – {date(trip.endDate)}
                      </p>
                      <button className="open-trip" onClick={() => selectTrip(trip.id)}>
                        Open<span>↗</span>
                      </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : active === "Trip Now" ? (
          <TripNowDashboard tripId={selectedTrip.id} onOpenExpenses={openExpenses} />
        ) : active === "Itinerary" ? (
          <ItineraryWorkspace tripId={selectedTrip.id} />
        ) : active === "Budget" ? (
          <>
            <BudgetWorkspace tripId={selectedTrip.id} trip={selectedTrip} onAddExpense={() => openExpenses()} />
            <FuelIntelligence tripId={selectedTrip.id} />
          </>
        ) : active === "Settlements" ? (
          <MoneySettlementWorkspace tripId={selectedTrip.id} />
        ) : active === "Analytics" ? (
          <AnalyticsWorkspace
            tripId={selectedTrip.id}
            onOpenSettings={() => router.push(`/trip/${selectedTrip.id}/settings`)}
          />
        ) : (
          <TripNowDashboard tripId={selectedTrip.id} onOpenExpenses={openExpenses} />
        )}

        {selectedTrip && (
          <nav className="bottom-nav">
            {tabs.slice(0, 2).map(({ label, icon: Icon }) => (
              <button
                key={label}
                className={active === label ? "nav-item active" : "nav-item"}
                onClick={() => go(label)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
            <button
              className="fab"
              onClick={() => openExpenses()}
              aria-label="Add expense"
            >
              <Plus size={25} />
            </button>
            {tabs.slice(2).map(({ label, icon: Icon }) => (
              <button
                key={label}
                className={active === label ? "nav-item active" : "nav-item"}
                onClick={() => go(label)}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}

        {expenseModalOpen && selectedTrip && (
          <ExpenseModal
            tripId={selectedTrip.id}
            initialCategory={expenseCategory}
            onClose={() => setExpenseModalOpen(false)}
            onSaved={() => {
              setExpenseModalOpen(false);
              window.dispatchEvent(new CustomEvent("routivity-refresh"));
            }}
          />
        )}
      </div>
      {loading && <LoadingScreen />}
    </main>
  );
}
