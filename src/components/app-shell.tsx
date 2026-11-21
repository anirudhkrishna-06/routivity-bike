"use client";

import { useState } from "react";
import { Activity, Bell, CalendarDays, ChevronRight, CircleDollarSign, Compass, Ellipsis, Home, MoreHorizontal, Plus, Settings2, Sparkles, Users, WalletCards, X } from "lucide-react";
import Image from "next/image";
import { ItineraryWorkspace } from "./itinerary-workspace";

const tabs = [
  { label: "Home", icon: Home }, { label: "Itinerary", icon: CalendarDays }, { label: "Expenses", icon: WalletCards }, { label: "Settle", icon: CircleDollarSign }, { label: "Activity", icon: Activity },
];

export function AppShell() {
  const [active, setActive] = useState("Home");
  const [showAdd, setShowAdd] = useState(false);
  const [dark, setDark] = useState(false);

  return <main className={dark ? "app dark" : "app"}>
    <div className="app-frame">
      <header className="topbar rise-in"><picture className="brand-logo"><source media="(prefers-color-scheme: dark)" srcSet="/dark-mode-logo.png"/><Image src="/logo.png" alt="Routivity" width={146} height={53} priority/></picture><div className="trip-switcher">Hampi loop <ChevronRight size={13}/></div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18}/><span className="notification-dot"/></button><button className="avatar">AK</button></div></header>
      {active === "Itinerary" ? <ItineraryWorkspace /> : null}
      <div className={active === "Itinerary" ? "dashboard-content hidden" : "dashboard-content"}>
      <section className="hero rise-in delay-1"><div className="eyebrow"><span className="live-dot"/> Saturday, 14 June 2025</div><h1>Make the miles<br/><em>worth remembering.</em></h1><p className="hero-copy">Your trip, your people, all in one calm place.</p><div className="hero-actions"><button className="primary-button" onClick={() => setShowAdd(true)}><Plus size={17}/> Add to trip</button><button className="ghost-button"><Users size={16}/> 3 members</button></div></section>
      <section className="trip-card rise-in delay-2"><div className="trip-card-top"><div><span className="card-kicker">UP NEXT · DAY 2 OF 5</span><h2>Hampi sunrise ride</h2><p><Compass size={14}/> Bengaluru <span className="route-line"/> Hampi</p></div><button className="more-button"><Ellipsis size={20}/></button></div><div className="trip-progress"><span style={{width:"42%"}}/></div><div className="trip-card-foot"><span>Tomorrow · 05:30</span><span className="status-pill">On track <span>↗</span></span></div></section>
      <section className="section-head rise-in delay-2"><div><span className="section-label">YOUR TRIP</span><h2>Keep the good stuff moving</h2></div><button className="text-button">View all <ChevronRight size={15}/></button></section>
      <section className="stat-grid rise-in delay-3"><div className="stat-card"><div className="stat-icon green"><WalletCards size={17}/></div><span>SPENT SO FAR</span><strong>₹8,420</strong><small>of ₹24,000 planned</small><div className="mini-progress"><i style={{width:"35%"}}/></div></div><div className="stat-card"><div className="stat-icon orange"><Users size={17}/></div><span>WHO OWES WHAT</span><strong>₹1,240</strong><small>you are owed</small><div className="people"><i>RS</i><i>MN</i><i>+1</i></div></div></section>
      <section className="activity-card rise-in delay-3"><div className="activity-head"><div><span className="section-label">RECENTLY</span><h2>Little updates</h2></div><button className="more-button"><MoreHorizontal size={19}/></button></div><div className="activity-row"><div className="activity-avatar coral">RS</div><div className="activity-text"><strong>Rohan added a stay</strong><span>Riverstone guesthouse · just now</span></div><span className="amount">₹3,600</span></div><div className="activity-row"><div className="activity-avatar yellow">MN</div><div className="activity-text"><strong>Meera settled up</strong><span>Thanks for the coffee · 2h ago</span></div><span className="settled">settled ✓</span></div></section>
      <section className="quote-card float rise-in delay-3"><Sparkles size={18}/><p>“A good trip is a collection of small stories.”</p><span>— Unknown, probably someone on a bike</span></section>
      </div>
      <nav className="bottom-nav">{tabs.map(({label, icon: Icon}) => <button key={label} className={active === label ? "nav-item active" : "nav-item"} onClick={() => setActive(label)}><Icon size={20}/><span>{label}</span></button>)}<button className="fab" onClick={() => setShowAdd(true)} aria-label="Add"><Plus size={25}/></button></nav>
      {showAdd && <div className="sheet-backdrop" onClick={() => setShowAdd(false)}><div className="add-sheet" onClick={e => e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span className="section-label">ADD SOMETHING</span><h2>What are we tracking?</h2></div><button className="close-button" onClick={() => setShowAdd(false)}><X size={20}/></button></div><div className="add-options"><button><div className="option-icon green"><WalletCards size={20}/></div><span><strong>Expense</strong><small>Split a payment with the group</small></span><ChevronRight size={18}/></button><button><div className="option-icon orange"><CalendarDays size={20}/></div><span><strong>Activity</strong><small>Add something to the itinerary</small></span><ChevronRight size={18}/></button></div></div></div>}
    </div>
    <button className="theme-toggle" onClick={() => setDark(!dark)} aria-label="Toggle theme"><Settings2 size={16}/></button>
  </main>;
}
