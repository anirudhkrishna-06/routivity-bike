import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { csvSchema, parseTripCsv } from "./csv";

const row = (values: Record<string, string>) => csvSchema.map((field) => values[field] || "").join(",");

describe("CSV itinerary import", () => {
  it("provides a fill-in template with the expected record sections", () => {
    const result = parseTripCsv(readFileSync(join(process.cwd(), "public/templates/routivity-sample.csv"), "utf8"));
    expect(result.trip?.trip_name).toBe(""); expect(result.members).toHaveLength(2); expect(result.budgets).toHaveLength(2); expect(result.activities).toHaveLength(2);
  });
  it("accepts a BOM and assistant markdown fences", () => expect(parseTripCsv("\uFEFF```csv\nrecord_type,trip_name,start_date,end_date\nTRIP,Trip,2026-01-01,2026-01-02\n```").trip?.trip_name).toBe("Trip"));
  it("parses DAY rows and every optional activity field", () => {
    const csv = [csvSchema.join(","), row({ record_type: "TRIP", trip_name: "Trip", start_date: "2026-01-01", end_date: "2026-01-02" }), row({ record_type: "MEMBER", member_id: "M1", member_name: "Rider" }), row({ record_type: "DAY", date: "2026-01-01", location: "Hampi" }), row({ record_type: "ACTIVITY", date: "2026-01-01", activity_type: "TRAVEL", title: "Ride", start_time: "09:00", end_time: "10:00", origin: "A", destination: "B", location: "B", notes: "Note", commitment: "CONFIRMED", time_window: "MORNING", duration_min: "60", travel_mode: "Bike", distance_km: "40" }), row({ record_type: "ACTIVITY", date: "2026-01-02", activity_type: "STAY", title: "Hotel", start_time: "16:00", location: "Hotel", notes: "Note", commitment: "TENTATIVE", time_window: "EVENING", duration_min: "90", nights: "2" })].join("\n");
    const result = parseTripCsv(csv); expect(result.days).toHaveLength(1); expect(result.activities[0].commitment).toBe("CONFIRMED"); expect(result.activities[0].distance_km).toBe("40"); expect(result.activities[1].nights).toBe("2"); expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
  });
  it("keeps the old CSV format backwards compatible", () => {
    const oldSchema = csvSchema.slice(0, 29); const oldRow = (values: Record<string, string>) => oldSchema.map((field) => values[field] || "").join(",");
    const old = [oldSchema.join(","), oldRow({ record_type: "TRIP", trip_name: "Old", start_date: "2026-01-01", end_date: "2026-01-02" }), oldRow({ record_type: "MEMBER", member_id: "M1", member_name: "Rider" }), oldRow({ record_type: "ACTIVITY", day_number: "1", date: "2026-01-01", activity_type: "EXPLORATION", title: "Museum", status: "PLANNED" })].join("\n");
    const result = parseTripCsv(old); expect(result.activities).toHaveLength(1); expect(result.activities[0].commitment).toBe("PLANNED"); expect(result.issues.some((issue) => issue.severity === "error")).toBe(false);
  });
  it("blocks activity dates outside the trip range", () => {
    const csv = ["record_type,trip_name,start_date,end_date,date,activity_type,title", "TRIP,Trip,2026-01-01,2026-01-02,,,", "ACTIVITY,Trip,2026-01-01,2026-01-02,2026-01-03,EXPLORATION,Outside"].join("\n");
    expect(parseTripCsv(csv).issues.some((issue) => issue.column === "date" && issue.severity === "error")).toBe(true);
  });
});
