import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTripCsv } from "./csv";

describe("sample itinerary CSV", () => {
  it("parses cleanly into one trip, three members, and four activities", () => {
    const csv = readFileSync(join(process.cwd(), "public/templates/routivity-sample.csv"), "utf8");
    const result = parseTripCsv(csv);
    expect(result.trip?.trip_name).toBe("Hampi loop");
    expect(result.members).toHaveLength(3);
    expect(result.activities).toHaveLength(4);
    expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
  });
});
