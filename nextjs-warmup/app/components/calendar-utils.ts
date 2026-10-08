import type { CalendarEventWithCategory } from "@/lib/database.types";
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function localInput(value: Date | string) {
  const date = new Date(value);
  return `${dayKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}
export function monthDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}
export function eventsOn(events: CalendarEventWithCategory[], day: Date) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = addDays(start, 1);
  return events.filter(
    (event) =>
      new Date(event.start_time) < end &&
      (new Date(event.end_time) > start ||
        dayKey(new Date(event.start_time)) === dayKey(start)),
  );
}
export function displayColor(value?: string | null) {
  if (value?.startsWith("#")) return value;
  const palette: Record<string, string> = {
    blue: "#739ef8",
    violet: "#a78bfa",
    purple: "#c084fc",
    green: "#72cba7",
    emerald: "#72cba7",
    teal: "#5cc9cb",
    rose: "#f08ba8",
    pink: "#f08ba8",
    red: "#ef8888",
    orange: "#eba471",
    amber: "#e5bc6b",
    yellow: "#e5bc6b",
    indigo: "#9294f5",
    slate: "#94a3b8",
    gray: "#9ca3af",
  };
  return palette[value?.replace(/^bg-/, "").split("-")[0] ?? ""] ?? "#a78bfa";
}
