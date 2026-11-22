export function formatDay(value: string, today = new Date()): string {
  const date = new Date(`${value}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const delta = Math.round((base.getTime() - day.getTime()) / 86400000);
  if (delta === 0) return "Today";
  if (delta === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === base.getFullYear() ? undefined : "numeric",
  }).format(date);
}
