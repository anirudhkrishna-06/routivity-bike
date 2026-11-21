import { describe, expect, it } from "vitest";
import { getTripNow, type NowActivity } from "./trip-now";

const activities: NowActivity[] = [
  { id: "ride", dayNumber: 1, date: "2026-09-23", type: "TRAVEL", title: "Chennai to Hampi", startTime: "06:00", endTime: "13:00", origin: "Chennai", destination: "Hampi", status: "planned" },
  { id: "stay", dayNumber: 1, date: "2026-09-23", type: "STAY", title: "Hampi stay", startTime: "18:00", endTime: "19:00", location: "Hampi", status: "planned" },
];

describe("Trip Now engine", () => {
  const base = { startDate: "2026-09-23", endDate: "2026-09-24", timezone: "Asia/Kolkata", activities };
  it("shows travelling with the active route and time remaining", () => { const result = getTripNow({ ...base, preview: { date: "2026-09-23", time: "09:40" } }); expect(result.kind).toBe("travelling"); expect(result.activity?.origin).toBe("Chennai"); expect(result.minutesRemaining).toBe(200); });
  it("shows the day before and rest days", () => { expect(getTripNow({ ...base, preview: { date: "2026-09-22", time: "10:00" } }).kind).toBe("day-before"); expect(getTripNow({ ...base, preview: { date: "2026-09-24", time: "10:00" } }).kind).toBe("rest"); });
  it("shows after-trip state", () => { expect(getTripNow({ ...base, preview: { date: "2026-09-25", time: "10:00" } }).kind).toBe("after"); });
});
