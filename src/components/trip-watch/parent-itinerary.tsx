"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { TravelInsights } from "@/components/itinerary-workspace";
import { dayDestination } from "@/lib/itinerary/engine";

type Day = { dayNumber: number; date: string; location: string | null };
type Activity = {
  dayNumber: number; type: string; title: string; startTime: string | null;
  endTime: string | null; origin: string | null; destination: string | null;
  location: string | null; mapsUrl: string | null; viaPoints: string | null;
  distanceKmMilli: number | null; notes: string | null; travelMode: string | null;
  stayNights: number | null; commitment: string; status: string;
};

function dateLabel(value: string, long = false) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: long ? "long" : "short", day: "numeric", month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function timeLabel(value: string | null) {
  if (!value) return "Anytime";
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function ParentItinerary({ days, activities, startDate, endDate }: { days: Day[]; activities: Activity[]; startDate: string; endDate: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const initialDay = days.find((day) => day.date === today)?.dayNumber || (today > endDate ? days.at(-1)?.dayNumber || 1 : 1);
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [expanded, setExpanded] = useState<string>();
  const day = days.find((item) => item.dayNumber === selectedDay) || days[0];
  const items = useMemo(() => activities.filter((item) => item.dayNumber === day?.dayNumber), [activities, day]);
  const destinations = useMemo(() => {
    const result = new Map<number, string>();
    const itineraryActivities = activities.map((item, index) => ({ ...item, id: String(index), date: days.find((candidate) => candidate.dayNumber === item.dayNumber)?.date || "" }));
    for (const item of days) {
      const value = dayDestination({ id: String(item.dayNumber), dayNumber: item.dayNumber, date: item.date, location: item.location }, itineraryActivities, result.get(item.dayNumber - 1));
      result.set(item.dayNumber, value);
    }
    return result;
  }, [activities, days]);
  const destination = destinations.get(day?.dayNumber || 0) || "Free day";

  return (
    <section className="trip-watch-itinerary new-itinerary">
      <div className="itinerary-top">
        <div>
          <h1>Your journey</h1>
          <p>Look out for the plan below!</p>
        </div>
      </div>

      <div className="day-rail" aria-label="Trip days">
        {days.map((item) => {
          const hasActivities = activities.some((activity) => activity.dayNumber === item.dayNumber);
          return (
            <button
              type="button"
              key={item.dayNumber}
              aria-selected={selectedDay === item.dayNumber}
              className={`day-chip ${selectedDay === item.dayNumber ? "selected" : ""} ${hasActivities ? "" : "empty"}`}
              onClick={() => { setSelectedDay(item.dayNumber); setExpanded(undefined); }}
            >
              <small>{dateLabel(item.date)}</small>
              <b>{destinations.get(item.dayNumber) || "Free day"}</b>
            </button>
          );
        })}
      </div>

      <div className="day-header">
        <div>
          <span className="section-label">{day ? dateLabel(day.date, true) : startDate}</span>
          <h2>{destination}</h2>
        </div>
      </div>

      <div className="timeline">
        <div className="timeline-rail" />
        {!items.length && <div className="empty-day"><h3>Nothing planned for {day ? dateLabel(day.date, true) : "this day"}</h3><p>A slower day by design.</p></div>}
        {items.map((item, index) => {
          const key = `${item.dayNumber}-${item.title}-${index}`;
          const open = expanded === key;
          return (
            <article className={`timeline-event ${item.type.toLowerCase()} ${open ? "expanded" : ""}`} key={key}>
              <button type="button" className="event-card" aria-expanded={open} onClick={() => setExpanded(open ? undefined : key)}>
                <span className="event-time">{timeLabel(item.startTime)}{item.endTime && ` – ${timeLabel(item.endTime)}`}</span>
                <span className="event-main"><b>{item.title}</b><small>{item.origin && item.destination ? `${item.origin} → ${item.destination}` : item.location || (item.type === "STAY" ? "Overnight stay" : "")}</small></span>
                <span className={`commitment ${item.status === "done" ? "done" : String(item.commitment || "PLANNED").toLowerCase()}`}>{item.status === "done" ? "done" : item.type === "STAY" ? "stay" : String(item.commitment || "PLANNED").toLowerCase()}</span>
              </button>
              <div className={`event-details ${open ? "open" : ""}`} aria-hidden={!open}>
                {item.type === "TRAVEL" ? <TravelInsights item={item} active={open} /> : item.notes && <p>{item.notes}</p>}
                {item.viaPoints && <small>Via {item.viaPoints}</small>}
                <p>{item.startTime ? `${timeLabel(item.startTime)}${item.endTime ? ` – ${timeLabel(item.endTime)}` : ""}` : "Timing is flexible"}{item.location ? ` · ${item.location}` : ""}</p>
                {item.mapsUrl && <a href={item.mapsUrl} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Open map</a>}
                {item.type === "STAY" && <small>Overnight stay · no completion required</small>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
