import { describe, expect, it } from "vitest";
import { canMove, classifyGap, continuity, freeWindows, isLocked, stayBands, suggestSlots } from "./engine";

describe("itinerary engine", () => {
  const items = [{ id: "a", dayNumber: 1, date: "2026-12-01", type: "EXPLORATION", title: "Temple", startTime: "08:30", endTime: "10:30" }, { id: "b", dayNumber: 1, date: "2026-12-01", type: "EXPLORATION", title: "Lunch", startTime: "13:00", endTime: "14:00" }];
  it("finds buffered free windows", () => expect(freeWindows(items).some((window) => window.start === 645 && window.end === 765)).toBe(true));
  it("ranks a fitting slot", () => expect(suggestSlots(items, 60, "ANYTIME")[0].kind).toBe("fit"));
  it("ranks tight and another-day slots after fit slots", () => {
    const packed = [{ ...items[0], startTime: "08:30", endTime: "10:30" }, { ...items[1], startTime: "10:35", endTime: "12:00" }];
    const result = suggestSlots(packed, 30, "MORNING", [{ dayNumber: 2, date: "2026-12-02", location: "Hampi", activities: [] }]);
    expect(result.some((item) => item.kind === "tight")).toBe(true); expect(result.some((item) => item.kind === "another-day")).toBe(true);
  });
  it("distinguishes overlap, tight buffer, and fit", () => { expect(classifyGap(600, 590)).toBe("overlap"); expect(classifyGap(600, 610)).toBe("tight"); expect(classifyGap(600, 630)).toBe("fit"); });
  it("never moves locked events", () => { expect(isLocked({ type: "TRAVEL", status: "planned", movable: true })).toBe(true); expect(isLocked({ type: "EXPLORATION", status: "done", movable: true })).toBe(true); expect(canMove({ type: "EXPLORATION", status: "planned", movable: true })).toBe(true); });
  it("derives stay check-in, nights, and checkout day", () => { const bands = stayBands([{ id: "d1", dayNumber: 1, date: "2026-12-01" }, { id: "d2", dayNumber: 2, date: "2026-12-02" }, { id: "d3", dayNumber: 3, date: "2026-12-03" }], [{ ...items[0], type: "STAY", title: "Hampi stay", startTime: "16:00", endTime: null, stayNights: 2 }]); expect(bands[0].checkOutDay).toBe(3); expect(bands[0].checkOutTime).toBe("11:00"); });
  it("reports travel continuity mismatches", () => { const result = continuity([{ id: "d1", dayNumber: 1, date: "2026-12-01" }, { id: "d2", dayNumber: 2, date: "2026-12-02" }], [{ ...items[0], dayNumber: 1, type: "TRAVEL", destination: "Badami" }, { ...items[1], dayNumber: 2, type: "TRAVEL", origin: "Hampi" }]); expect(result[0].message).toContain("Badami"); });
});
