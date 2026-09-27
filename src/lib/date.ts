export const CLINIC_TIME_ZONE = "America/Sao_Paulo";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: CLINIC_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Data de hoje (YYYY-MM-DD) no fuso do estúdio. */
export function getTodayKey(reference: Date = new Date()) {
  return dateKeyFormatter.format(reference);
}

/** Hora atual (HH:MM) no fuso do estúdio. */
export function getCurrentTime(reference: Date = new Date()) {
  return timeFormatter.format(reference);
}

/** Normaliza horários do Postgres (`HH:MM:SS`) para `HH:MM`. */
export function normalizeTime(time: string) {
  const [hour = "00", minute = "00"] = time.split(":");
  return `${hour.padStart(2, "0")}:${minute}`;
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey: string, amount: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return formatDateKey(date);
}

export function getWeekStart(dateKey: string) {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const distanceToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + distanceToMonday);
  return formatDateKey(date);
}

export function getWeekDays(dateKey: string, count = 6) {
  const start = getWeekStart(dateKey);
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export { calculateEndTime } from "./scheduling";
