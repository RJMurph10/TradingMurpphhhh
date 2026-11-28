// Server-only access to Alpaca's free market data API (https://docs.alpaca.markets/docs/about-market-data-api).
// Keys come from the Lovable Cloud secrets ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY and never reach the browser.
//
// Free plan, in plain terms:
// - Live prices come from the IEX exchange in real time, including pre-market and after-hours trades.
// - Full-market (SIP) data, used for daily history and volume, is available up to 15 minutes ago.

import { serverEnv } from "@/lib/server-env";
import { etDate } from "./session";
import type { DailyBar, PricePoint, Trade } from "./quotes";

const DATA_URL = "https://data.alpaca.markets";
/** Optional override, only for pointing local development at a test server. */
const dataUrl = () => serverEnv("ALPACA_DATA_URL") ?? DATA_URL;

export class AlpacaError extends Error {
  constructor(
    public reason: "missing-keys" | "auth" | "unavailable",
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

function keys() {
  const id = serverEnv("ALPACA_API_KEY_ID");
  const secret = serverEnv("ALPACA_API_SECRET_KEY");
  if (!id || !secret)
    throw new AlpacaError(
      "missing-keys",
      "Live data isn't connected yet. Add ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY in Lovable Cloud → Secrets.",
    );
  return { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": secret };
}

async function get<T>(path: string, params: Record<string, string | undefined>): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined),
  );
  const res = await fetch(`${dataUrl()}${path}?${qs}`, { headers: { ...keys(), accept: "application/json" } });
  if (res.status === 401) throw new AlpacaError("auth", "Alpaca didn't accept the API keys. Check both secrets in Lovable Cloud.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AlpacaError(
      "unavailable",
      `Alpaca returned ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

/* ---------- a small in-memory cache, so many visitors share one request ---------- */

const cache = new Map<string, { expires: number; value: Promise<unknown> }>();
function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { expires: Date.now() + ttlMs, value });
  value.catch(() => cache.delete(key));
  if (cache.size > 2000) for (const [k, v] of cache) if (v.expires < Date.now()) cache.delete(k);
  return value;
}

/* ---------- bars ---------- */

type RawBar = { t: string; o: number; h: number; l: number; c: number; v: number };
type BarsPage = { bars: Record<string, RawBar[] | undefined> | null; next_page_token: string | null };

async function barsPaged(params: Record<string, string | undefined>) {
  const out: Record<string, RawBar[]> = {};
  let page: string | undefined;
  for (let i = 0; i < 20; i++) {
    const res = await get<BarsPage>("/v2/stocks/bars", { ...params, limit: "10000", page_token: page });
    for (const [sym, list] of Object.entries(res.bars ?? {})) (out[sym] ??= []).push(...(list ?? []));
    if (!res.next_page_token) break;
    page = res.next_page_token;
  }
  return out;
}

/** Whether this account may read full-market (SIP) history; remembered after the first try. */
let sipAllowed: boolean | undefined;

async function dailyBatch(symbols: string[], days: number) {
  const start = new Date(Date.now() - days * 86_400_000).toISOString();
  const params = { symbols: symbols.join(","), timeframe: "1Day", start, adjustment: "all" };
  if (sipAllowed !== false) {
    try {
      // The free plan allows full-market data that is at least 15 minutes old.
      const end = new Date(Date.now() - 16 * 60_000).toISOString();
      const bars = await barsPaged({ ...params, end, feed: "sip" });
      sipAllowed = true;
      return bars;
    } catch (e) {
      // 403/422: this plan can't read SIP data. Anything else is a real failure.
      if (!(e instanceof AlpacaError) || (e.status !== 403 && e.status !== 422)) throw e;
      sipAllowed = false;
    }
  }
  return barsPaged({ ...params, feed: "iex" });
}

/** Daily bars for each symbol over the last `days` calendar days. */
export async function dailyBars(symbols: string[], days: number): Promise<Record<string, DailyBar[]>> {
  const unique = [...new Set(symbols)].sort();
  // Refresh every 2 minutes so today's bar (volume, high, low) keeps up.
  const raw = await cached(`daily:${days}:${unique.join(",")}`, 120_000, () => dailyBatch(unique, days));
  return Object.fromEntries(
    unique.map((s) => [
      s,
      (raw[s] ?? []).map((b) => ({ date: etDate(b.t), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })),
    ]),
  );
}

/** Intraday bars from the real-time IEX feed, pre-market and after-hours included. */
export async function intradayBars(symbol: string, range: "1D" | "1W"): Promise<PricePoint[]> {
  const timeframe = range === "1D" ? "5Min" : "30Min";
  const days = range === "1D" ? 5 : 10;
  const raw = await cached(`intraday:${symbol}:${range}`, 30_000, () =>
    barsPaged({
      symbols: symbol,
      timeframe,
      start: new Date(Date.now() - days * 86_400_000).toISOString(),
      feed: "iex",
    }),
  );
  const bars = raw[symbol] ?? [];
  const points = bars.map((b) => ({ date: b.t, price: b.c, benchmark: 0, volume: b.v }));
  if (range === "1D") {
    // Only the most recent trading day.
    const lastDay = bars.length ? etDate(bars[bars.length - 1]!.t) : "";
    return points.filter((p) => etDate(p.date) === lastDay);
  }
  return points;
}

/* ---------- latest trades ---------- */

type LatestTrades = { trades: Record<string, { p: number; t: string } | undefined> };

/** The most recent trade per symbol, in real time from IEX (pre-market and after-hours included). */
export async function latestTrades(symbols: string[]): Promise<Record<string, Trade>> {
  const unique = [...new Set(symbols)].sort();
  const res = await cached(`trades:${unique.join(",")}`, 10_000, () =>
    get<LatestTrades>("/v2/stocks/trades/latest", { symbols: unique.join(","), feed: "iex" }),
  );
  const out: Record<string, Trade> = {};
  for (const [s, t] of Object.entries(res.trades ?? {})) if (t) out[s] = { p: t.p, t: t.t };
  return out;
}

/* ---------- news ---------- */

export type NewsItem = {
  id: number;
  headline: string;
  source: string;
  url: string;
  created_at: string;
  symbols: string[];
};

export async function latestNews(symbols?: string[]): Promise<NewsItem[]> {
  const key = symbols?.length ? symbols.join(",") : "market";
  const res = await cached(`news:${key}`, 120_000, () =>
    get<{ news: NewsItem[] }>("/v1beta1/news", {
      limit: "8",
      sort: "desc",
      symbols: symbols?.length ? symbols.join(",") : undefined,
    }),
  );
  return (res.news ?? []).map(({ id, headline, source, url, created_at, symbols }) => ({
    id,
    headline,
    source,
    url,
    created_at,
    symbols: symbols ?? [],
  }));
}
