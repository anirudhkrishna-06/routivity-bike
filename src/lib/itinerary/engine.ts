export type ItineraryDay = {
  id: string;
  dayNumber: number;
  date: string;
  location?: string | null;
};
export type ItineraryActivity = {
  id: string;
  dayNumber: number;
  date: string;
  type: string;
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  origin?: string | null;
  destination?: string | null;
  status?: string;
  movable?: boolean;
  commitment?: string;
  durationMin?: number | null;
};
export type TimeWindow = { start: number; end: number; label: string };

export function minutes(value?: string | null) {
  if (!value) return undefined;
  const [h, m] = value.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : undefined;
}
export function hhmm(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
export function duration(
  activity: Pick<ItineraryActivity, "startTime" | "endTime" | "durationMin">,
) {
  const start = minutes(activity.startTime);
  const end = minutes(activity.endTime);
  return start !== undefined && end !== undefined && end > start
    ? end - start
    : activity.durationMin || undefined;
}
export function formatDuration(value?: number | null) {
  if (!value) return "";
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return hours ? `${hours}h${mins ? ` ${mins}m` : ""}` : `${mins}m`;
}
export function dayDestination(
  day: ItineraryDay,
  activities: ItineraryActivity[],
  previous?: string,
) {
  if (day.location) return day.location;
  const items = activities.filter((a) => a.dayNumber === day.dayNumber);
  return (
    items.findLast((a) => a.type === "TRAVEL" && a.destination)?.destination ||
    items.find((a) => a.type === "STAY" && a.location)?.location ||
    items.find((a) => a.location)?.location ||
    previous ||
    ""
  );
}
export function daySummary(day: ItineraryDay, activities: ItineraryActivity[]) {
  const items = activities.filter((a) => a.dayNumber === day.dayNumber);
  const travel = items.filter((a) => a.type === "TRAVEL").length;
  const stays = items.filter((a) => a.type === "STAY").length;
  return `${items.length} ${items.length === 1 ? "event" : "events"}${travel ? ` · ${travel} travel` : ""}${stays ? ` · ${stays} stay` : ""}`;
}
export function freeWindows(
  items: ItineraryActivity[],
  dayStart = 360,
  dayEnd = 1320,
  buffer = 15,
): TimeWindow[] {
  const timed = items
    .map((item) => ({
      item,
      start: minutes(item.startTime),
      end: minutes(item.endTime),
    }))
    .filter(
      (item): item is { item: ItineraryActivity; start: number; end: number } =>
        item.start !== undefined &&
        item.end !== undefined &&
        item.end > item.start,
    )
    .sort((a, b) => a.start - b.start);
  const result: TimeWindow[] = [];
  let cursor = dayStart;
  for (const item of timed) {
    const start = Math.max(cursor, dayStart);
    const end = Math.min(item.start - buffer, dayEnd);
    if (end - start >= 30)
      result.push({ start, end, label: `${hhmm(start)}–${hhmm(end)}` });
    cursor = Math.max(cursor, item.end + buffer);
  }
  if (dayEnd - cursor >= 30)
    result.push({
      start: cursor,
      end: dayEnd,
      label: `${hhmm(cursor)}–${hhmm(dayEnd)}`,
    });
  return result;
}
export function preferredRange(preference?: string): [number, number] {
  return preference === "MORNING"
    ? [360, 720]
    : preference === "AFTERNOON"
      ? [720, 1020]
      : preference === "EVENING"
        ? [1020, 1320]
        : [360, 1320];
}
export type SlotSuggestion = {
  start: number;
  end: number;
  kind: "fit" | "tight" | "nudge" | "another-day";
  reasons: string[];
  changes: { id: string; title: string; from: string; to: string }[];
};
export function suggestSlots(
  items: ItineraryActivity[],
  wantedDuration: number,
  preference?: string,
  otherDays: { dayNumber: number; date: string; location?: string | null; activities: ItineraryActivity[] }[] = [],
): SlotSuggestion[] {
  const [preferredStart] = preferredRange(preference);
  const slots = freeWindows(items);
  const ranked: SlotSuggestion[] = slots.flatMap((slot) => {
    const start = Math.max(slot.start, preferredStart);
    const end = start + wantedDuration;
    return end <= slot.end
      ? [
          {
            start,
            end,
            kind: "fit" as const,
            reasons: [
              `Fits in the ${slot.label} window with 15-minute buffers`,
            ],
            changes: [],
          },
        ]
      : [];
  });
  const tight = freeWindows(items, 360, 1320, 5).flatMap((slot) => {
    const start = Math.max(slot.start, preferredStart); const end = start + wantedDuration;
    return end <= slot.end && !ranked.some((item) => item.start === start) ? [{ start, end, kind: "tight" as const, reasons: [`Fits in ${slot.label}, but the buffer is tight`], changes: [] }] : [];
  });
  const elsewhere = otherDays.flatMap((day) => freeWindows(day.activities).flatMap((slot) => slot.end - slot.start >= wantedDuration ? [{ start: slot.start, end: slot.start + wantedDuration, kind: "another-day" as const, reasons: [`Day ${day.dayNumber} has a compatible free window`], changes: [] }] : []));
  return [...ranked, ...tight, ...elsewhere]
    .sort(
      (a, b) =>
        Math.abs(a.start - preferredStart) - Math.abs(b.start - preferredStart),
    )
    .slice(0, 3);
}

export function classifyGap(previousEnd: number, nextStart: number, buffer = 15) {
  const gap = nextStart - previousEnd;
  return gap < 0 ? "overlap" : gap < buffer ? "tight" : "fit";
}

export function isLocked(activity: Pick<ItineraryActivity, "movable" | "type" | "status">) {
  return activity.movable === false || activity.type === "STAY" || activity.type === "TRAVEL" || activity.status === "done" || activity.status === "skipped";
}

export function canMove(activity: Pick<ItineraryActivity, "movable" | "type" | "status">) { return !isLocked(activity); }

export type StayBand = { activityId: string; title: string; location?: string | null; checkInDay: number; checkInTime?: string | null; nights: number; checkOutDay: number; checkOutTime: string };
export function stayBands(days: ItineraryDay[], activities: (ItineraryActivity & { stayNights?: number | null })[]): StayBand[] {
  return activities.filter((item) => item.type === "STAY").map((item) => { const nights = Math.max(1, item.stayNights || 1); const checkInDay = item.dayNumber; return { activityId: item.id, title: item.title, location: item.location, checkInDay, checkInTime: item.startTime, nights, checkOutDay: Math.min(days.length || checkInDay, checkInDay + nights), checkOutTime: "11:00" }; });
}

export function continuity(days: ItineraryDay[], activities: ItineraryActivity[]) {
  return days.slice(0, -1).flatMap((day) => { const current = activities.filter((item) => item.dayNumber === day.dayNumber); const next = activities.filter((item) => item.dayNumber === day.dayNumber + 1); const end = current.findLast((item) => item.type === "TRAVEL" && item.destination)?.destination || current.findLast((item) => item.location)?.location; const start = next.find((item) => item.type === "TRAVEL" && item.origin)?.origin || next.find((item) => item.location)?.location; return end && start && end.toLowerCase() !== start.toLowerCase() ? [{ fromDay: day.dayNumber, toDay: day.dayNumber + 1, message: `Day ${day.dayNumber} ends in ${end} but Day ${day.dayNumber + 1} starts in ${start}` }] : []; });
}
export function conflict(
  items: ItineraryActivity[],
  start?: string,
  end?: string,
  exceptId?: string,
) {
  const a = minutes(start);
  const b = minutes(end);
  if (a === undefined || b === undefined) return undefined;
  return items.find(
    (item) =>
      item.id !== exceptId &&
      minutes(item.startTime) !== undefined &&
      minutes(item.endTime) !== undefined &&
      a < minutes(item.endTime)! &&
      minutes(item.startTime)! < b,
  );
}
