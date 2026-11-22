"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, CalendarDays, CircleDollarSign, LogOut, Plus, WalletCards } from "lucide-react";
import { ItineraryWorkspace } from "./itinerary-workspace";
import { ItineraryTools } from "./scheduling-panel";
import { FuelIntelligence } from "./fuel-intelligence";
import { MoneySettlementWorkspace } from "./money-settlement-workspace";
import { BudgetWorkspace } from "./budget-workspace";
import { AnalyticsWorkspace } from "./analytics-workspace";
import { TripNowDashboard } from "./trip-now-dashboard";
import { LoadingScreen } from "./loading-screen";
import { ExpenseModal } from "./expense-modal";
type Trip = { id: string; name: string; startDate: string; endDate: string; currency: string; timezone: string };
type Props = { user: { name: string; email: string }; trips: Trip[]; initialTripId?: string };
type ThemeMode = "system" | "light" | "dark";
const SchedulingPanel = ItineraryTools;
const tabs = [{ label: "Itinerary", icon: CalendarDays }, { label: "Budget", icon: WalletCards }, { label: "Settlements", icon: CircleDollarSign }, { label: "Analytics", icon: BarChart3 }];
function date(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value + "T00:00:00")); }
function tripStatus(trip: Trip) { const today = new Date().toISOString().slice(0, 10); return today < trip.startDate ? "UPCOMING" : today > trip.endDate ? "PAST" : "ACTIVE"; }
function resolvedDark(mode: ThemeMode) { return mode === "dark" || (mode === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches); }
export function AppShell({ user, trips, initialTripId }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState("Trip Now");
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(initialTripId && trips.some((trip) => trip.id === initialTripId) ? initialTripId : undefined);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<string | undefined>();
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId);
  const dark = mounted ? resolvedDark(theme) : false;

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem("routivity-theme") as ThemeMode | null;
    const next = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setTheme(next);
    document.documentElement.dataset.theme = resolvedDark(next) ? "dark" : "light";
    const onTheme = (event: Event) => {
      const mode = (event as CustomEvent<ThemeMode>).detail;
      setTheme(mode);
      document.documentElement.dataset.theme = resolvedDark(mode) ? "dark" : "light";
    };
    const onSystem = () => {
      if (next === "system") document.documentElement.dataset.theme = resolvedDark("system") ? "dark" : "light";
    };
    window.addEventListener("routivity-theme-change", onTheme);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", onSystem);
    return () => {
      window.removeEventListener("routivity-theme-change", onTheme);
      window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", onSystem);
    };
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

  return (
    <main className={dark ? "app dark" : "app"}>
      <div className="app-frame">
        <header className="topbar">
          {selectedTrip && (
            <button
              className="topbar-back"
              onClick={goToAllTrips}
              aria-label="Back to all trips"
              title="Back to all trips"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <button className="brand-home" onClick={goToAllTrips} aria-label="Back to all trips">
            <Image
              src={dark ? "/dark-mode-logo.png" : "/logo.png"}
              alt="Routivity"
              width={112}
              height={41}
              priority
            />
          </button>
          <div className="top-actions">
            <button
              className="avatar"
              onClick={() => setProfileOpen((open) => !open)}
              aria-label="Open profile menu"
            >
              {user.name.slice(0, 2).toUpperCase()}
            </button>
            {profileOpen && (
              <div className="profile-menu">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <button onClick={() => void signOut()}>
                  <LogOut size={15} /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        {!selectedTrip ? (
          <section className="trip-hub rise-in">
            <div className="hub-heading">
              <div>
                <span className="section-label">YOUR TRIPS</span>
                <h1>Where are you going?</h1>
                <p>Select a trip to open its live dashboard, itinerary, money, and shared settings.</p>
              </div>
              <Link className="primary-button" href="/trips/new">
                <Plus size={17} /> New trip
              </Link>
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
                    <article className="trip-hub-card" key={trip.id}>
                      <div className="trip-card-line">
                        <span className={`trip-status ${status.toLowerCase()}`}>{status}</span>
                      </div>
                      <h2>{trip.name}</h2>
                      <p>
                        <CalendarDays size={14} /> {date(trip.startDate)} – {date(trip.endDate)}
                      </p>
                      <button className="open-trip" onClick={() => selectTrip(trip.id)}>
                        Open dashboard <span>↗</span>
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : active === "Trip Now" ? (
          <TripNowDashboard tripId={selectedTrip.id} onOpenExpenses={openExpenses} />
        ) : active === "Itinerary" ? (
          <>
            <ItineraryWorkspace tripId={selectedTrip.id} />
            <SchedulingPanel tripId={selectedTrip.id} />
          </>
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
