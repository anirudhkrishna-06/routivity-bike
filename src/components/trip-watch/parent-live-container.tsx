"use client";
import { useEffect, useMemo, useState } from "react";
import { getTripNow, type NowActivity } from "@/lib/trip-now";
import { LivelyContainer } from "@/components/lively-container";

type Activity = { date: string; dayNumber: number; type: string; title: string; startTime: string | null; endTime: string | null; origin: string | null; destination: string | null; location: string | null; notes: string | null; travelMode: string | null; stayNights: number | null; status: string };

export function ParentLiveContainer({ trip, activities }: { trip: { name: string; startDate: string; endDate: string; timezone: string }; activities: Activity[] }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const normalized = useMemo(() => activities.map((item, index) => ({ ...item, id: String(index), type: item.type, status: item.status } as NowActivity)), [activities]);
  const state = getTripNow({ ...trip, activities: normalized, now });
  const stay = activities.find((item) => item.type === "STAY" && item.date === state.date);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: trip.timezone, hour: "2-digit", hourCycle: "h23" }).format(now));
  const overnight = hour >= 21 || hour < 6;
  const isStay = state.kind === "stay" || state.activity?.type === "STAY";
  const place = state.activity?.type === "TRAVEL" ? state.activity.destination : state.activity?.location || stay?.location;
  const showOvernight = overnight || isStay;
  const overnightStay = (state.activity?.type === "STAY" ? state.activity : stay) as Activity | undefined;
  const stayName = overnightStay?.title?.trim() || overnightStay?.location?.trim() || "Settle in for the night";
  const title = showOvernight ? stayName : state.kind === "free" ? place ? `You're in ${place}.` : "Take the scenic route." : state.title;
  const description = showOvernight ? `${overnightStay?.location || stayName}. ${overnightStay?.stayNights || 1} night${overnightStay?.stayNights === 1 ? "" : "s"} planned.` : state.kind === "free" ? state.nextActivity ? `Nothing on the clock right now. Next up: ${state.nextActivity.title}.` : "The best moments aren't always on the itinerary." : state.description;
  const stayActivity = (state.activity?.type === "STAY" ? state.activity : stay) as NowActivity | undefined;
  return <LivelyContainer state={state} stay={stayActivity} isStay={isStay} overnight={overnight} title={title} description={description} readOnly onDone={() => undefined} onStayDone={() => undefined} />;
}
