import Papa from "papaparse";
import { buildMapsUrl } from "./maps";

export type CsvRow = Record<string, string>;
export type CsvIssue = {
  row: number;
  column: string;
  severity: "error" | "warning";
  message: string;
};
export type ImportPreview = {
  trip?: CsvRow;
  members: CsvRow[];
  activities: CsvRow[];
  budgets: CsvRow[];
  days: CsvRow[];
  issues: CsvIssue[];
  unknownColumns: string[];
};

export const csvSchema = [
  "record_type",
  "trip_name",
  "start_date",
  "end_date",
  "creator_name",
  "currency",
  "timezone",
  "member_id",
  "member_name",
  "member_email",
  "category",
  "budget_type",
  "planned_amount",
  "applicable_to",
  "day_number",
  "date",
  "activity_type",
  "title",
  "start_time",
  "end_time",
  "origin",
  "destination",
  "location",
  "via_points",
  "maps_url",
  "bike_id",
  "status",
  "notes",
  "commitment",
  "time_window",
  "duration_min",
  "travel_mode",
  "distance_km",
  "nights",
];
const schema = new Set(csvSchema);

function cleanCsvText(csv: string) {
  return csv
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```(?:csv)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function isAllowedMapsUrl(value: string) {
  try {
    return new Set([
      "google.com",
      "www.google.com",
      "maps.google.com",
      "maps.app.goo.gl",
      "goo.gl",
    ]).has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function parseTripCsv(csv: string): ImportPreview {
  const parsed = Papa.parse<CsvRow>(cleanCsvText(csv), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const issues: CsvIssue[] = parsed.errors.map((error) => ({
    row: (error.row ?? 0) + 2,
    column: "file",
    severity: "error",
    message: error.message,
  }));
  const unknownColumns = (parsed.meta.fields ?? []).filter(
    (field) => !schema.has(field),
  );
  unknownColumns.forEach((column) =>
    issues.push({
      row: 1,
      column,
      severity: "warning",
      message: "Unknown column will be ignored.",
    }),
  );
  const rows = parsed.data.map((row) => {
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === "string"
          ? value.trim()
          : value == null
            ? ""
            : String(value),
      ]),
    );
    if (normalized.record_type === "ACTIVITY") {
      const typeAliases: Record<string, string> = {
        RIDE: "TRAVEL",
        TRIP: "TRAVEL",
        SIGHTSEEING: "EXPLORATION",
        OTHER: "CUSTOM",
      };
      normalized.activity_type =
        typeAliases[normalized.activity_type?.toUpperCase()] ||
        normalized.activity_type?.toUpperCase() ||
        "";
      const statusAliases: Record<string, string> = {
        PLANNED: "planned",
        IN_PROGRESS: "planned",
        DONE: "done",
        COMPLETED: "done",
        SKIPPED: "skipped",
      };
      normalized.status =
        statusAliases[normalized.status?.toUpperCase()] ||
        normalized.status?.toLowerCase() ||
        "planned";
      normalized.commitment = normalized.commitment?.toUpperCase() || "PLANNED";
    }
    return normalized;
  });
  const tripRows = rows.filter((r) => r.record_type === "TRIP");
  if (tripRows.length !== 1)
    issues.push({
      row: 1,
      column: "record_type",
      severity: "error",
      message: "CSV must contain exactly one TRIP row.",
    });
  const trip = tripRows[0];
  const members = rows.filter((r) => r.record_type === "MEMBER");
  const budgets = rows.filter((r) => r.record_type === "BUDGET");
  const activities = rows.filter((r) => r.record_type === "ACTIVITY");
  const days = rows.filter((r) => r.record_type === "DAY");
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    if (row.record_type === "ACTIVITY") {
      for (const column of ["date", "activity_type", "title"])
        if (!row[column])
          issues.push({
            row: rowNumber,
            column,
            severity: "error",
            message: `${column} is required for an activity.`,
          });
      if (
        row.activity_type &&
        !["TRAVEL", "STAY", "EXPLORATION", "CUSTOM"].includes(row.activity_type)
      )
        issues.push({
          row: rowNumber,
          column: "activity_type",
          severity: "error",
          message: "Use RIDE/TRAVEL, STAY, EXPLORATION, or CUSTOM.",
        });
      if (row.status && !["planned", "done", "skipped"].includes(row.status))
        issues.push({
          row: rowNumber,
          column: "status",
          severity: "error",
          message: "Use PLANNED, DONE, or SKIPPED.",
        });
      if (row.activity_type === "TRAVEL" && (!row.origin || !row.destination))
        issues.push({
          row: rowNumber,
          column: "origin/destination",
          severity: "error",
          message: "Travel activities need both an origin and destination.",
        });
      if (
        row.date &&
        trip?.start_date &&
        trip?.end_date &&
        (row.date < trip.start_date || row.date > trip.end_date)
      )
        issues.push({
          row: rowNumber,
          column: "date",
          severity: "error",
          message: `Date ${row.date} is outside the trip (${trip.start_date}–${trip.end_date}).`,
        });
      if (
        row.commitment &&
        !["PLANNED", "OPTIONAL", "TENTATIVE", "CONFIRMED"].includes(
          row.commitment,
        )
      )
        issues.push({
          row: rowNumber,
          column: "commitment",
          severity: "error",
          message: "Use PLANNED, OPTIONAL, TENTATIVE, or CONFIRMED.",
        });
      if (
        row.time_window &&
        !["MORNING", "AFTERNOON", "EVENING", "ANYTIME"].includes(
          row.time_window.toUpperCase(),
        )
      )
        issues.push({
          row: rowNumber,
          column: "time_window",
          severity: "error",
          message: "Use MORNING, AFTERNOON, EVENING, or ANYTIME.",
        });
      if (
        row.duration_min &&
        (!/^\d+$/.test(row.duration_min) || Number(row.duration_min) <= 0)
      )
        issues.push({
          row: rowNumber,
          column: "duration_min",
          severity: "error",
          message: "Use a positive duration in minutes.",
        });
      if (row.nights && (!/^\d+$/.test(row.nights) || Number(row.nights) < 1))
        issues.push({
          row: rowNumber,
          column: "nights",
          severity: "error",
          message: "Stay nights must be a positive whole number.",
        });
      if (row.maps_url && !isAllowedMapsUrl(row.maps_url))
        issues.push({
          row: rowNumber,
          column: "maps_url",
          severity: "warning",
          message:
            "This link is not a Google Maps host and will be replaced with a safe fallback.",
        });
      if (row.start_time && row.end_time && row.end_time <= row.start_time)
        issues.push({
          row: rowNumber,
          column: "end_time",
          severity: "warning",
          message: "End time is not after start time.",
        });
      if (row.activity_id) {
        if (seen.has(row.activity_id))
          issues.push({
            row: rowNumber,
            column: "activity_id",
            severity: "error",
            message: "Activity ID must be unique.",
          });
        seen.add(row.activity_id);
      }
    }
    if (row.record_type === "MEMBER" && !row.member_name)
      issues.push({
        row: rowNumber,
        column: "member_name",
        severity: "error",
        message: "Member name is required.",
      });
  }
  for (const [index, row] of rows.entries())
    if (row.record_type === "BUDGET") {
      const rowNumber = index + 2;
      for (const column of ["category", "budget_type", "planned_amount"])
        if (!row[column])
          issues.push({
            row: rowNumber,
            column,
            severity: "error",
            message: `${column} is required for a budget rule.`,
          });
      if (row.planned_amount && !/^\d+(\.\d{1,2})?$/.test(row.planned_amount))
        issues.push({
          row: rowNumber,
          column: "planned_amount",
          severity: "error",
          message: "Use a rupee amount such as 500 or 500.50.",
        });
      if (
        row.applicable_to &&
        row.applicable_to !== "ALL" &&
        !/^\d{4}-\d{2}-\d{2}$/.test(row.applicable_to)
      )
        issues.push({
          row: rowNumber,
          column: "applicable_to",
          severity: "error",
          message: "Use ALL or a date in YYYY-MM-DD format.",
        });
    }
  for (const [index, row] of days.entries()) {
    const rowNumber = rows.findIndex((candidate) => candidate === row) + 2;
    if (!row.date)
      issues.push({
        row: rowNumber || index + 2,
        column: "date",
        severity: "error",
        message: "A DAY row needs a date.",
      });
    if (
      row.date &&
      trip?.start_date &&
      trip?.end_date &&
      (row.date < trip.start_date || row.date > trip.end_date)
    )
      issues.push({
        row: rowNumber || index + 2,
        column: "date",
        severity: "error",
        message: `Date ${row.date} is outside the trip.`,
      });
  }
  return { trip, members, activities, budgets, days, issues, unknownColumns };
}

export function normalizeActivity(row: CsvRow) {
  return {
    ...row,
    maps_url: buildMapsUrl({
      mapsUrl: row.maps_url,
      type: row.activity_type,
      origin: row.origin,
      destination: row.destination,
      location: row.location,
      viaPoints: row.via_points,
    }),
  };
}

export function exportItinerary(rows: CsvRow[]) {
  return Papa.unparse(rows, { quotes: true });
}
