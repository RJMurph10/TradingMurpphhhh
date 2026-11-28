// When the US stock market is open, in New York time.
//   Pre-market   4:00 AM – 9:30 AM
//   Regular      9:30 AM – 4:00 PM  (1:00 PM on early-close days)
//   After hours  4:00 PM – 8:00 PM  (1:00 PM – 5:00 PM on early-close days)
//   Closed       overnight, weekends and exchange holidays

export type Session = "pre" | "regular" | "post" | "closed";

export const SESSION_LABEL: Record<Session, string> = {
  pre: "Pre-market",
  regular: "Market open",
  post: "After hours",
  closed: "Market closed",
};

/** NYSE full-day holidays. Update once a year from nyse.com/markets/hours-calendars. */
const HOLIDAYS = new Set([
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19",
  "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18",
  "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
  "2028-01-17", "2028-02-21", "2028-04-14", "2028-05-29", "2028-06-19", "2028-07-04",
  "2028-09-04", "2028-11-23", "2028-12-25",
]);
/** Days the regular session ends at 1:00 PM. */
const EARLY_CLOSE = new Set(["2026-11-27", "2026-12-24", "2027-11-26", "2028-07-03", "2028-11-24"]);

const etParts = (d: Date) => {
  const p: Record<string, string> = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return {
    date: `${p["year"]}-${p["month"]}-${p["day"]}`,
    minutes: (Number(p["hour"]) % 24) * 60 + Number(p["minute"]),
  };
};

/** "YYYY-MM-DD" in New York for an instant. */
export const etDate = (d: Date | string) => etParts(new Date(d)).date;

export const isTradingDay = (date: string) => {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !HOLIDAYS.has(date);
};

/** Minutes after midnight ET when the regular session closes on a trading day. */
export const isEarlyClose = (date: string) => EARLY_CLOSE.has(date);

export const closeMinutes = (date: string) => (EARLY_CLOSE.has(date) ? 13 * 60 : 16 * 60);

export function marketSession(now: Date = new Date()): Session {
  const { date, minutes } = etParts(now);
  if (!isTradingDay(date)) return "closed";
  const close = closeMinutes(date);
  if (minutes < 4 * 60) return "closed";
  if (minutes < 9 * 60 + 30) return "pre";
  if (minutes < close) return "regular";
  if (minutes < close + 4 * 60) return "post";
  return "closed";
}

/** The instant a trading day's regular session closed, as epoch milliseconds. */
export function closeInstant(date: string) {
  const mins = closeMinutes(date);
  // New York is UTC-5 or UTC-4; try both and keep the one that reads back as the right ET time.
  for (const offset of [4, 5]) {
    const t = Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)),
      Math.floor(mins / 60) + offset,
      mins % 60,
    );
    const p = etParts(new Date(t));
    if (p.date === date && p.minutes === mins) return t;
  }
  return Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), 21);
}

/** True when an instant falls in the regular session of its day. */
export function inRegularHours(iso: string) {
  const { date, minutes } = etParts(new Date(iso));
  return isTradingDay(date) && minutes >= 9 * 60 + 30 && minutes < closeMinutes(date);
}
