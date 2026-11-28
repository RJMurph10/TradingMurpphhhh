// Server functions the pages call for live market data. They run on the server, so the Alpaca keys stay secret.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AlpacaError, dailyBars, intradayBars, latestNews, latestTrades, type NewsItem } from "./alpaca.server";
import { closesToPoints, summarize, type PricePoint } from "./quotes";
import { scoreStock, type Scored } from "./quant";
import { marketSession, type Session } from "./session";
import { BENCHMARK, isTicker } from "./universe";

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
