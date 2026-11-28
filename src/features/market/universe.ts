// The tickers the app tracks, with the names and sectors shown next to them.
// Prices are never stored here: they come live from Alpaca (see alpaca.server.ts).

export type Listing = { ticker: string; name: string; sector: string };

/** Large US companies across every sector. Used for movers, breadth, signals and the ticker tape. */
export const STOCKS: Listing[] = [
  { ticker: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { ticker: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer cyclical" },
  { ticker: "META", name: "Meta Platforms Inc.", sector: "Communication" },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Communication" },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Consumer cyclical" },
  { ticker: "AVGO", name: "Broadcom Inc.", sector: "Technology" },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Technology" },
  { ticker: "ORCL", name: "Oracle Corporation", sector: "Technology" },
  { ticker: "CRM", name: "Salesforce Inc.", sector: "Technology" },
  { ticker: "ADBE", name: "Adobe Inc.", sector: "Technology" },
  { ticker: "INTC", name: "Intel Corporation", sector: "Technology" },
  { ticker: "NFLX", name: "Netflix Inc.", sector: "Communication" },
  { ticker: "DIS", name: "Walt Disney Company", sector: "Communication" },
  { ticker: "HD", name: "Home Depot Inc.", sector: "Consumer cyclical" },
  { ticker: "MCD", name: "McDonald's Corporation", sector: "Consumer cyclical" },
  { ticker: "NKE", name: "Nike Inc.", sector: "Consumer cyclical" },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Consumer defensive" },
  { ticker: "COST", name: "Costco Wholesale", sector: "Consumer defensive" },
  { ticker: "KO", name: "Coca-Cola Company", sector: "Consumer defensive" },
  { ticker: "PG", name: "Procter & Gamble", sector: "Consumer defensive" },
  { ticker: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
  { ticker: "BAC", name: "Bank of America", sector: "Financials" },
  { ticker: "GS", name: "Goldman Sachs Group", sector: "Financials" },
  { ticker: "V", name: "Visa Inc.", sector: "Financials" },
  { ticker: "MA", name: "Mastercard Inc.", sector: "Financials" },
  { ticker: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
  { ticker: "LLY", name: "Eli Lilly and Company", sector: "Healthcare" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { ticker: "PFE", name: "Pfizer Inc.", sector: "Healthcare" },
  { ticker: "XOM", name: "Exxon Mobil Corporation", sector: "Energy" },
  { ticker: "CVX", name: "Chevron Corporation", sector: "Energy" },
  { ticker: "CAT", name: "Caterpillar Inc.", sector: "Industrials" },
  { ticker: "BA", name: "Boeing Company", sector: "Industrials" },
  { ticker: "GE", name: "GE Aerospace", sector: "Industrials" },
];

/**
 * Index cards. Real index levels (like the S&P 500 itself) are licensed and not free anywhere,
 * so each card shows the exchange-traded fund that tracks that index, which is what most traders watch.
 */
export const INDEX_FUNDS: (Listing & { tracks: string })[] = [
  { ticker: "SPY", name: "SPDR S&P 500 ETF", tracks: "S&P 500", sector: "ETF" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", tracks: "Nasdaq-100", sector: "ETF" },
  { ticker: "DIA", name: "SPDR Dow Jones ETF", tracks: "Dow Jones", sector: "ETF" },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", tracks: "Russell 2000", sector: "ETF" },
  { ticker: "VIXY", name: "ProShares VIX Short-Term Futures", tracks: "Volatility (VIX)", sector: "ETF" },
];

/** One SPDR fund per sector, for the sector heatmap. */
export const SECTOR_FUNDS: (Listing & { label: string })[] = [
  { ticker: "XLK", label: "Technology", name: "Technology Select Sector SPDR", sector: "ETF" },
  { ticker: "XLC", label: "Communication", name: "Communication Services Select Sector SPDR", sector: "ETF" },
  { ticker: "XLY", label: "Consumer cyclical", name: "Consumer Discretionary Select Sector SPDR", sector: "ETF" },
  { ticker: "XLP", label: "Consumer defensive", name: "Consumer Staples Select Sector SPDR", sector: "ETF" },
  { ticker: "XLF", label: "Financials", name: "Financial Select Sector SPDR", sector: "ETF" },
  { ticker: "XLV", label: "Healthcare", name: "Health Care Select Sector SPDR", sector: "ETF" },
  { ticker: "XLE", label: "Energy", name: "Energy Select Sector SPDR", sector: "ETF" },
  { ticker: "XLI", label: "Industrials", name: "Industrial Select Sector SPDR", sector: "ETF" },
  { ticker: "XLB", label: "Materials", name: "Materials Select Sector SPDR", sector: "ETF" },
  { ticker: "XLRE", label: "Real estate", name: "Real Estate Select Sector SPDR", sector: "ETF" },
  { ticker: "XLU", label: "Utilities", name: "Utilities Select Sector SPDR", sector: "ETF" },
];

export const BENCHMARK = "SPY";

/** Everything the dashboard needs in one request. */
export const MARKET_SYMBOLS = [
  ...INDEX_FUNDS.map((f) => f.ticker),
  ...STOCKS.map((s) => s.ticker),
  ...SECTOR_FUNDS.map((f) => f.ticker),
];

/** Tickers offered in pickers (stocks first, then the index funds). */
export const PICKER_SYMBOLS = [...STOCKS.map((s) => s.ticker), ...INDEX_FUNDS.map((f) => f.ticker)];

const byTicker = new Map<string, Listing>(
  [...STOCKS, ...INDEX_FUNDS, ...SECTOR_FUNDS].map((l) => [l.ticker, l]),
);

/** Name and sector for a ticker; unknown tickers (anything you search) get their symbol as the name. */
export function listing(ticker: string): Listing {
  const t = ticker.toUpperCase();
  return byTicker.get(t) ?? { ticker: t, name: t, sector: "Other" };
}

/** US stock and ETF symbols: 1 to 5 capital letters (the same rule the saved watchlist uses). */
export const isTicker = (s: string) => /^[A-Z]{1,5}$/.test(s);
