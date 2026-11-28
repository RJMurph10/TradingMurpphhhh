// Turns raw exchange data (daily bars + the latest trade) into the numbers shown on screen.
// Pure functions: no network, so they run the same on the server and in tests.

import { closeInstant, etDate, inRegularHours, type Session } from "./session";
import { listing } from "./universe";

/** One trading day. `date` is the New York date, "YYYY-MM-DD". */
export type DailyBar = { date: string; o: number; h: number; l: number; c: number; v: number };
export type Trade = { p: number; t: string };

/** A point on a chart. `benchmark` is an optional second line (comparison or buy-and-hold). */
export type PricePoint = {
  date: string;
  price: number;
  benchmark: number;
  volume: number;
  /** True for today's point while the market is still open (its volume is only part of a day). */
  partial?: boolean;
};

export type Quote = {
  ticker: string;
  name: string;
  sector: string;
  /** Latest regular-session price: the live price while the market is open, otherwise the last close. */
  price: number;
  /** Percent change of `price` versus the previous session's close. */
  change: number;
  prevClose: number;
  /** Shares traded in the latest session (about 15 minutes behind on the free data plan). */
  volume: number;
  dayHigh: number | null;
  dayLow: number | null;
  /** Pre-market or after-hours trading since the last close, when there is any. */
  ext: { label: "Pre-market" | "After hours"; price: number; change: number } | null;
  /** When the latest trade happened. */
  lastTradeAt: string | null;
};

export function summarize(
  ticker: string,
  bars: DailyBar[],
  trade: Trade | null,
  session: Session,
  now: Date,
): Quote | null {
  const today = etDate(now);
  const live = session === "pre" || session === "regular";
  // Sessions that have finished. Today's bar only counts once today's regular session is over.
  const done = bars.filter((b) => b.date < today || (b.date === today && !live));
  const todayBar = bars.find((b) => b.date === today);
  const info = listing(ticker);
  const base = { ticker: info.ticker, name: info.name, sector: info.sector, lastTradeAt: trade?.t ?? null };

  if (session === "regular") {
    const prevClose = done.at(-1)?.c;
    if (!prevClose) return null;
    const tradeIsToday = trade && etDate(trade.t) === today;
    const price = tradeIsToday ? trade.p : (todayBar?.c ?? prevClose);
    return {
      ...base,
      price,
      prevClose,
      change: (price / prevClose - 1) * 100,
      volume: todayBar?.v ?? 0,
      dayHigh: todayBar ? Math.max(todayBar.h, price) : null,
      dayLow: todayBar ? Math.min(todayBar.l, price) : null,
      ext: null,
    };
  }

  const last = done.at(-1);
  const prev = done.at(-2);
  if (!last) return null;
  const prevClose = prev?.c ?? last.o;
  let ext: Quote["ext"] = null;
  if (trade && new Date(trade.t).getTime() > closeInstant(last.date) && !inRegularHours(trade.t)) {
    const label = etDate(trade.t) === last.date ? "After hours" : "Pre-market";
    ext = { label, price: trade.p, change: (trade.p / last.c - 1) * 100 };
  }
  return {
    ...base,
    price: last.c,
    prevClose,
    change: (last.c / prevClose - 1) * 100,
    volume: last.v,
    dayHigh: last.h,
    dayLow: last.l,
    ext,
  };
}

/** Daily closes as chart points, with the live price standing in for today while the market is open. */
export function closesToPoints(bars: DailyBar[], quote: Quote | null, session: Session, now: Date) {
  const today = etDate(now);
  const points: PricePoint[] = bars
    .filter((b) => b.date !== today || (session !== "pre" && session !== "regular"))
    .map((b) => ({ date: b.date, price: b.c, benchmark: 0, volume: b.v }));
  if (session === "regular" && quote) {
    points.push({ date: today, price: quote.price, benchmark: 0, volume: quote.volume, partial: true });
  }
  return points;
}
