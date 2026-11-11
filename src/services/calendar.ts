export const DEFAULT_TIME_ZONE = "Asia/Jakarta";

export function validTimeZone(value?: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value || DEFAULT_TIME_ZONE });
    return value || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function calendarDate(date: Date | string | number, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(date));
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

// Convert a calendar boundary to UTC using the requested IANA time zone.
export function calendarMidnight(year: number, month: number, day: number, timeZone: string) {
  const target = Date.UTC(year, month - 1, day);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = formatter.formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    const correction = target - local;
    if (!correction) return new Date(instant).toISOString();
    instant += correction;
  }
  throw new Error("Batas tanggal tidak dapat ditentukan pada zona waktu ini.");
}
