import { TZDate } from "@date-fns/tz";

export function inTripTimezone(date: Date | string | number, timezone: string) { return new TZDate(new Date(date).getTime(), timezone); }
export function formatTripDate(date: Date | string | number, timezone: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: timezone, day: "numeric", month: "short", ...options }).format(new Date(date));
}
