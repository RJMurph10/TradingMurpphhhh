import type { Holding } from '@/features/collections/research-context';
import { getStock, sampleHistory, type PricePoint } from './sample-data';
import { indicators, mean } from './quant';

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

export function portfolioAnalytics(holdings: Holding[]) {
  const positions = holdings.flatMap((holding) => {
    const stock = getStock(holding.ticker);
    return stock ? [{ ...holding, stock, value: holding.shares * stock.price, cost: holding.shares * holding.cost_basis }] : [];
  });
  const value = positions.reduce((sum, position) => sum + position.value, 0);
  const cost = positions.reduce((sum, position) => sum + position.cost, 0);
  const previousValue = positions.reduce((sum, position) => sum + position.shares * position.stock.price / (1 + position.stock.change / 100), 0);
  const histories = positions.map((position) => sampleHistory(position.ticker));
  const benchmarkHistory = sampleHistory('SPY');
  const initialValue = positions.reduce((sum, position, i) => sum + position.shares * (histories[i]?.[0]?.price ?? 0), 0);
  const initialBenchmark = benchmarkHistory[0]?.price ?? 1;
  const curve: PricePoint[] = benchmarkHistory.map((point, i) => ({
    date: point.date,
    price: positions.reduce((sum, position, p) => sum + position.shares * (histories[p]?.[i]?.price ?? 0), 0),
    benchmark: initialValue * point.price / initialBenchmark,
    volume: 0,
  }));
  const stats = indicators(curve);
  let peak = curve[0]?.price ?? 0;
  let maxDrawdown = 0;
  for (const point of curve) {
    peak = Math.max(peak, point.price);
    if (peak) maxDrawdown = Math.max(maxDrawdown, (peak - point.price) / peak * 100);
  }
  const sectorValues = new Map<string, number>();
  for (const position of positions) sectorValues.set(position.stock.sector, (sectorValues.get(position.stock.sector) ?? 0) + position.value);
  const sectorExposure = [...sectorValues].map(([sector, amount]) => ({ sector, amount, weight: value ? amount / value * 100 : 0 })).sort((a, b) => b.amount - a.amount);
  const correlations = positions.map((position, i) => ({
    ticker: position.ticker,
    values: positions.map((other, j) => correlation(returns(histories[i] ?? []), returns(histories[j] ?? []))),
  }));
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
    benchmarkReturn: (benchmarkHistory.at(-1)!.price / initialBenchmark - 1) * 100,
    sectorExposure,
    correlations,
  };
}
