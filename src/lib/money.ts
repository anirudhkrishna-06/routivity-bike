export type Paise = number & { readonly __brand: "paise" };

export function rupeesToPaise(value: string | number): Paise {
  const parsed = typeof value === "number" ? value : Number(value.replace(/,/g, "").trim());
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Amount must be a non-negative number");
  return Math.round(parsed * 100) as Paise;
}

export function formatPaise(amount: Paise | number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount / 100);
}

export function splitEqual(total: Paise, memberIds: readonly string[]): Record<string, Paise> {
  if (!memberIds.length) throw new Error("At least one member is required");
  const ordered = [...memberIds].sort();
  const base = Math.floor(total / ordered.length);
  const remainder = total - base * ordered.length;
  return Object.fromEntries(ordered.map((id, index) => [id, (base + (index < remainder ? 1 : 0)) as Paise]));
}

/** Split using integer basis points (10000 = 100%). */
export function splitPercentBasisPoints(total: Paise, percentages: Record<string, number>): Record<string, Paise> {
  const entries = Object.entries(percentages).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length || entries.some(([, basisPoints]) => !Number.isInteger(basisPoints) || basisPoints < 0) || entries.reduce((sum, [, basisPoints]) => sum + basisPoints, 0) !== 10000) throw new Error("Percentages must be non-negative integers that sum to 10000 basis points");
  const exact = entries.map(([id, basisPoints]) => ({ id, floor: Math.floor(total * basisPoints / 10000), remainder: (total * basisPoints) % 10000 }));
  let remaining = total - exact.reduce((sum, item) => sum + item.floor, 0);
  exact.sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));
  for (const item of exact) { if (remaining <= 0) break; item.floor += 1; remaining -= 1; }
  return Object.fromEntries(exact.map((item) => [item.id, item.floor as Paise]));
}

export function sumPaise(values: readonly (Paise | number)[]): Paise {
  return values.reduce((total, value) => total + value, 0) as Paise;
}
