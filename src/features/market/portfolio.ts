import type { Holding } from "@/features/collections/research-context";
import type { PricePoint, Quote } from "./quotes";
import { indicators, mean } from "./quant";

export function correlation(a: number[], b: number[]) {
  if (a.length !== b.length || a.length < 2) return null;
  const aMean = mean(a);
  const bMean = mean(b);
  const covariance = mean(a.map((value, i) => (value - aMean) * ((b[i] ?? bMean) - bMean)));
  const aDeviation = Math.sqrt(mean(a.map((value) => (value - aMean) ** 2)));
  const bDeviation = Math.sqrt(mean(b.map((value) => (value - bMean) ** 2)));
  return aDeviation && bDeviation ? covariance / (aDeviation * bDeviation) : null;
}

function returns(points: PricePoint[]) {
  return points.slice(1).map((point, i) => point.price / (points[i]?.price ?? point.price) - 1);
}

/**
 * Value, performance and risk of a set of holdings, from live quotes and the last year of daily closes.
 * `histories` holds each ticker's closes; `benchmark` is SPY's.
 */
export function portfolioAnalytics(
  holdings: Holding[],
  quotes: Record<string, Quote>,
  histories: Record<string, PricePoint[]>,
  benchmarkHistory: PricePoint[],
) {
  const positions = holdings.flatMap((holding) => {
    const stock = quotes[holding.ticker];
    return stock
      ? [{ ...holding, stock, value: holding.shares * stock.price, cost: holding.shares * holding.cost_basis }]
      : [];
  });
  const value = positions.reduce((sum, position) => sum + position.value, 0);
  const cost = positions.reduce((sum, position) => sum + position.cost, 0);
  const previousValue = positions.reduce((sum, position) => sum + position.shares * position.stock.prevClose, 0);
  // Line every holding up on the benchmark's dates, carrying the last known close forward.
  const dates = benchmarkHistory.slice(-252).map((p) => p.date);
  const aligned = positions.map((position) => {
    const byDate = new Map((histories[position.ticker] ?? []).map((p) => [p.date, p.price]));
    let lastSeen = 0;
    return dates.map((d) => (lastSeen = byDate.get(d) ?? lastSeen));
  });
  const initialValue = positions.reduce((sum, position, i) => sum + position.shares * (aligned[i]?.[0] ?? 0), 0);
  const benchByDate = new Map(benchmarkHistory.map((p) => [p.date, p.price]));
  const initialBenchmark = benchByDate.get(dates[0] ?? "") ?? 1;
  const curve: PricePoint[] = dates.map((date, i) => ({
    date,
    price: positions.reduce((sum, position, p) => sum + position.shares * (aligned[p]?.[i] ?? 0), 0),
    benchmark: (initialValue * (benchByDate.get(date) ?? initialBenchmark)) / initialBenchmark,
    volume: 0,
  }));
  const stats = indicators(curve);
  let peak = curve[0]?.price ?? 0;
  let maxDrawdown = 0;
  for (const point of curve) {
    peak = Math.max(peak, point.price);
    if (peak) maxDrawdown = Math.max(maxDrawdown, ((peak - point.price) / peak) * 100);
  }
  const sectorValues = new Map<string, number>();
  for (const position of positions)
    sectorValues.set(position.stock.sector, (sectorValues.get(position.stock.sector) ?? 0) + position.value);
  const sectorExposure = [...sectorValues]
    .map(([sector, amount]) => ({ sector, amount, weight: value ? (amount / value) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const series = aligned.map((prices) => returns(prices.map((price) => ({ date: "", price, benchmark: 0, volume: 0 }))));
  const correlations = positions.map((position, i) => ({
    ticker: position.ticker,
    values: positions.map((_, j) => correlation(series[i] ?? [], series[j] ?? [])),
  }));
  const benchLast = benchByDate.get(dates.at(-1) ?? "") ?? initialBenchmark;
  return {
    positions,
    value,
    cost,
    totalReturn: cost ? (value / cost - 1) * 100 : 0,
    dayChange: value - previousValue,
    dayReturn: previousValue ? (value / previousValue - 1) * 100 : 0,
    curve,
    volatility: stats.volatility,
    sharpe: stats.sharpe,
    maxDrawdown,
    benchmarkReturn: (benchLast / initialBenchmark - 1) * 100,
    sectorExposure,
    correlations,
  };
}
