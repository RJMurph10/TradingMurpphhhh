import { describe, expect, it } from "vitest";
import { backtest, composite, scoreStock, type BacktestOptions } from "@/features/market/quant";
import { correlation, portfolioAnalytics } from "@/features/market/portfolio";
import { closesToPoints, summarize, type DailyBar, type PricePoint } from "@/features/market/quotes";

/** A made-up but realistic price path, only for testing the math. */
function path(count: number, start = 100, seed = 1): PricePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(2025, 0, 2 + i));
    return {
      date: d.toISOString().slice(0, 10),
      price: +(start + i * 0.08 + 3 * Math.sin(i * 0.09 + seed) + Math.sin(i * 0.5)).toFixed(2),
      benchmark: 0,
      volume: 1_000_000 + 200_000 * Math.sin(i * 0.4 + seed),
    };
  });
}

const history = path(400);
const options: BacktestOptions = {
  ticker: "SPY",
  strategy: "Moving average crossover",
  capital: 100000,
  allocation: 90,
  cost: 0,
  slippage: 0,
  fast: 20,
  slow: 50,
  start: history[0]!.date,
  end: history.at(-1)!.date,
};

describe("quantitative research rules", () => {
  it("includes transaction costs in backtest results", () => {
    const free = backtest(options, history);
    const charged = backtest({ ...options, cost: 25 }, history);
    expect(charged.curve.at(-1)!.price).toBeLessThanOrEqual(free.curve.at(-1)!.price);
    expect(free.trades).toBeGreaterThan(0);
  });

  it("rejects a fast average that is not shorter than the slow average", () => {
    expect(() => backtest({ ...options, fast: 50, slow: 20 }, history)).toThrow(
      "Check capital, position sizing, dates, and moving-average periods.",
    );
  });

  it("excludes unavailable models from the weighted composite", () => {
    const result = composite(
      [
        { name: "Momentum", direction: 1, expected: 2, note: "", available: true },
        { name: "Machine learning", direction: -1, expected: -20, note: "", available: false },
      ],
      [25, 100],
    );
    expect(result).toEqual({ direction: "Bullish", expected: 2 });
  });

  it("scores a stock between 0 and 100 with an explanation", () => {
    const quote = summarize("NVDA", [], null, "closed", new Date());
    expect(quote).toBeNull();
    const bars: DailyBar[] = history.map((p) => ({ date: p.date, o: p.price, h: p.price, l: p.price, c: p.price, v: p.volume }));
    const q = summarize("NVDA", bars, null, "closed", new Date("2026-06-01T12:00:00Z"))!;
    const scored = scoreStock(q, history, path(400, 500, 3));
    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.score).toBeLessThanOrEqual(100);
    expect(scored.explanation).toContain(scored.momentum.toFixed(1));
    expect(scored.spark).toHaveLength(30);
  });

  it("values a portfolio from live prices and cost basis", () => {
    const aapl = summarize(
      "AAPL",
      [
        { date: "2026-11-24", o: 1, h: 1, l: 1, c: 230, v: 1 },
        { date: "2026-11-25", o: 1, h: 1, l: 1, c: 237.49, v: 1 },
      ],
      null,
      "closed",
      new Date("2026-11-28T12:00:00Z"),
    )!;
    const result = portfolioAnalytics([{ ticker: "AAPL", shares: 2, cost_basis: 220 }], { AAPL: aapl }, { AAPL: history }, history);
    expect(result.value).toBeCloseTo(474.98, 2);
    expect(result.cost).toBe(440);
    expect(result.totalReturn).toBeCloseTo(7.95, 2);
    expect(result.dayChange).toBeCloseTo(2 * (237.49 - 230), 6);
  });

  it("returns perfect correlation for identical return series", () => {
    expect(correlation([0.01, -0.02, 0.03], [0.01, -0.02, 0.03])).toBeCloseTo(1, 10);
  });

  it("uses the live price for today's chart point only while the market is open", () => {
    const bars: DailyBar[] = [
      { date: "2026-11-27", o: 100, h: 101, l: 99, c: 100, v: 10 },
      { date: "2026-11-30", o: 101, h: 103, l: 100, c: 102, v: 5 },
    ];
    const now = new Date("2026-11-30T16:00:00Z"); // 11:00 AM ET
    const quote = summarize("SPY", bars, { p: 103.5, t: "2026-11-30T15:59:00Z" }, "regular", now);
    const points = closesToPoints(bars, quote, "regular", now);
    expect(points.map((p) => p.price)).toEqual([100, 103.5]);
  });
});
