// Server functions the pages call for live market data. They run on the server, so the Alpaca keys stay secret.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AlpacaError, dailyBars, intradayBars, latestNews, latestTrades, type NewsItem } from "./alpaca.server";
import { closesToPoints, summarize, type DailyBar, type PricePoint } from "./quotes";
import { scoreStock, type Scored } from "./quant";
import { etDate, marketSession, type Session } from "./session";
import { BENCHMARK, isTicker, STOCKS } from "./universe";
import {
  boardRow,
  dayFacts,
  explain,
  gradePick,
  leanOf,
  signalBook,
  strengthOf,
  type Board,
  type PickResult,
} from "./edges";

export type Live<T> =
  | { ok: true; data: T; session: Session; asOf: string }
  | { ok: false; reason: AlpacaError["reason"]; message: string };

async function live<T>(load: (session: Session, now: Date) => Promise<T>): Promise<Live<T>> {
  const now = new Date();
  const session = marketSession(now);
  try {
    return { ok: true, data: await load(session, now), session, asOf: now.toISOString() };
  } catch (e) {
    if (e instanceof AlpacaError) return { ok: false, reason: e.reason, message: e.message };
    console.error(e);
    return { ok: false, reason: "unavailable", message: "Live market data is temporarily unavailable." };
  }
}

const symbolList = z.array(z.string().transform((s) => s.trim().toUpperCase())).max(80);
const clean = (symbols: string[]) => [...new Set(symbols.filter(isTicker))];

/** About 13 months of sessions: enough for 52-week highs/lows and the 200-day average. */
const QUOTE_DAYS = 400;
/** Two years for research charts, models and backtests. */
const HISTORY_DAYS = 760;

/** Live quotes plus research scores for a list of tickers. Unknown tickers are left out. */
export const getQuotes = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ symbols: symbolList }).parse(data))
  .handler(({ data }) =>
    live<Scored[]>(async (session, now) => {
      const symbols = clean(data.symbols);
      if (!symbols.length) return [];
      const all = clean([...symbols, BENCHMARK]);
      const [daily, trades] = await Promise.all([dailyBars(all, QUOTE_DAYS), latestTrades(symbols)]);
      const benchBars = daily[BENCHMARK] ?? [];
      const benchQuote = summarize(BENCHMARK, benchBars, null, session, now);
      const benchmark = closesToPoints(benchBars, benchQuote, session, now);
      return symbols.flatMap((s) => {
        const bars = daily[s] ?? [];
        const quote = summarize(s, bars, trades[s] ?? null, session, now);
        return quote ? [scoreStock(quote, closesToPoints(bars, quote, session, now), benchmark)] : [];
      });
    }),
  );

/** Two years of daily closes per ticker (today's live price included while the market is open). */
export const getHistory = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ symbols: symbolList }).parse(data))
  .handler(({ data }) =>
    live<Record<string, PricePoint[]>>(async (session, now) => {
      const symbols = clean(data.symbols);
      if (!symbols.length) return {};
      const [daily, trades] = await Promise.all([dailyBars(symbols, HISTORY_DAYS), latestTrades(symbols)]);
      return Object.fromEntries(
        symbols.map((s) => {
          const bars = daily[s] ?? [];
          return [s, closesToPoints(bars, summarize(s, bars, trades[s] ?? null, session, now), session, now)];
        }),
      );
    }),
  );

/** Today's (or this week's) price path, every 5 or 30 minutes, including pre-market and after-hours. */
export const getIntraday = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ symbol: z.string().transform((s) => s.toUpperCase()), range: z.enum(["1D", "1W"]) }).parse(data),
  )
  .handler(({ data }) =>
    live<PricePoint[]>(async () => (isTicker(data.symbol) ? intradayBars(data.symbol, data.range) : [])),
  );

/** Recent market headlines (Benzinga, via Alpaca). */
export const getNews = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ symbols: symbolList.optional() }).parse(data ?? {}))
  .handler(({ data }) => live<NewsItem[]>(() => latestNews(data.symbols ? clean(data.symbols) : undefined)));

/** Finished sessions only: today's bar is left out until today's regular session is over. */
const finished = (bars: DailyBar[], session: Session, now: Date) => {
  const today = etDate(now);
  const live = session === "pre" || session === "regular";
  return bars.filter((b) => b.date < today || (b.date === today && !live));
};

/**
 * Edge Finder: today's unusual gaps and volume across the tracked stocks, each with the signal's real
 * two-year record, so a pick can be judged like a bet with a known history.
 */
export const getEdges = createServerFn({ method: "GET" }).handler(() =>
  live<Board>(async (session, now) => {
    const symbols = STOCKS.map((s) => s.ticker);
    const [daily, trades] = await Promise.all([dailyBars(symbols, HISTORY_DAYS), latestTrades(symbols)]);
    const today = etDate(now);
    const done = Object.fromEntries(symbols.map((s) => [s, finished(daily[s] ?? [], session, now)]));
    const facts = Object.fromEntries(symbols.map((s) => [s, dayFacts(done[s]!)]));
    const book = signalBook(Object.values(facts));
    const refDate = Object.values(done).reduce((d, bars) => (bars.at(-1)?.date ?? "") > d ? bars.at(-1)!.date : d, "");
    const when: Board["when"] = session === "pre" ? "pre" : session === "regular" ? "today" : "last";
    const rows = symbols.flatMap((s) => {
      const bars = daily[s] ?? [];
      const quote = summarize(s, bars, trades[s] ?? null, session, now);
      if (!quote) return [];
      const todayBar = session === "regular" ? (bars.find((b) => b.date === today) ?? null) : null;
      const row = boardRow(quote, done[s]!, todayBar, session, now);
      if (!row) return [];
      const strength = strengthOf(row);
      const own = signalBook([facts[s]!]);
      return [
        {
          ...row,
          strength,
          flagged: strength >= 1,
          lean: leanOf(row, book),
          reasons: explain({ ...row, strength }, book, own, { when, refDate, stocks: symbols.length }),
        },
      ];
    });
    rows.sort((a, b) => b.strength - a.strength);
    return { when, date: when === "last" || when === "pre" ? refDate : today, rows, book, stocks: symbols.length };
  }),
);

const pickInput = z.object({
  id: z.string().max(64),
  ticker: z.string().transform((s) => s.trim().toUpperCase()),
  side: z.enum(["up", "down"]),
  entry: z.number().positive(),
  at: z.string().datetime(),
  signal: z.string().max(80),
});

/** Grades paper picks against real closing prices: did the entry beat the close, and how did it end up? */
export const getPickResults = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ picks: z.array(pickInput).max(300) }).parse(data))
  .handler(({ data }) =>
    live<PickResult[]>(async (session, now) => {
      const picks = data.picks.filter((p) => isTicker(p.ticker));
      if (!picks.length) return [];
      const oldest = Math.min(...picks.map((p) => Date.parse(p.at)));
      const days = Math.min(HISTORY_DAYS, Math.ceil((now.getTime() - oldest) / 86_400_000) + 15);
      // From a little before the oldest pick, so its grading session and the 5 after it are included.
      const daily = await dailyBars(clean(picks.map((p) => p.ticker)), Math.max(days, 30));
      return picks.map((p) => gradePick(p, finished(daily[p.ticker] ?? [], session, now)));
    }),
  );
