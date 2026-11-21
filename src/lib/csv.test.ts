import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTripCsv } from "./csv";

describe("sample itinerary CSV", () => {
  it("provides a fill-in template with the expected record sections", () => {
    const csv = readFileSync(join(process.cwd(), "public/templates/routivity-sample.csv"), "utf8");
    const result = parseTripCsv(csv);
    expect(result.trip?.trip_name).toBe("");
    expect(result.members).toHaveLength(2);
    expect(result.budgets).toHaveLength(2);
    expect(result.activities).toHaveLength(2);
  });
});
