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

export function sumPaise(values: readonly (Paise | number)[]): Paise {
  return values.reduce((total, value) => total + value, 0) as Paise;
}
