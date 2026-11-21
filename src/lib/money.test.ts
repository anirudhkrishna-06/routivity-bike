import { describe, expect, it } from "vitest";
import { splitEqual, sumPaise } from "./money";

describe("paise-safe equal splits", () => {
  it("splits ₹100 among three members without losing a paisa", () => {
    const shares = splitEqual(10000 as never, ["member-c", "member-a", "member-b"]);
    expect(shares).toEqual({ "member-a": 3334, "member-b": 3333, "member-c": 3333 });
    expect(sumPaise(Object.values(shares))).toBe(10000);
  });
});
