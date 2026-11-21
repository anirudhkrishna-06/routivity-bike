import { describe, expect, it } from "vitest";
import { splitEqual, splitPercentBasisPoints, sumPaise } from "./money";

describe("expense split invariants", () => {
  it("keeps exact and percentage splits in paise", () => {
    expect(sumPaise(Object.values(splitEqual(10000 as never, ["a", "b", "c"])))).toBe(10000);
    const split = splitPercentBasisPoints(10000 as never, { a: 3333, b: 3333, c: 3334 });
    expect(split).toEqual({ a: 3333, b: 3333, c: 3334 });
    expect(sumPaise(Object.values(split))).toBe(10000);
  });
});
