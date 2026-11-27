import { describe, expect, it } from 'vitest';
import { backtest, composite, rankOpportunities, type BacktestOptions } from '@/features/market/quant';
import { correlation, portfolioAnalytics } from '@/features/market/portfolio';

const options: BacktestOptions = { ticker: 'SPY', strategy: 'Moving average crossover', capital: 100000, allocation: 90, cost: 0, slippage: 0, fast: 20, slow: 50, start: '2025-01-02', end: '2025-09-10' };

describe('quantitative research rules', () => {
  it('includes transaction costs in backtest results', () => {
    const free = backtest(options);
    const charged = backtest({ ...options, cost: 25 });
    expect(charged.curve.at(-1)!.price).toBeLessThanOrEqual(free.curve.at(-1)!.price);
  });

  it('rejects a fast average that is not shorter than the slow average', () => {
    expect(() => backtest({ ...options, fast: 50, slow: 20 })).toThrow('Check capital, position sizing, dates, and moving-average periods.');
  });

  it('excludes unavailable models from the weighted composite', () => {
    const result = composite([
      { name: 'Momentum', direction: 1, expected: 2, note: '', available: true },
      { name: 'Machine learning', direction: -1, expected: -20, note: '', available: false },
    ], [25, 100]);
    expect(result).toEqual({ direction: 'Bullish', expected: 2 });
  });

  it('ranks every non-ETF sample stock with a bounded score and explanation', () => {
    const ranked = rankOpportunities();
    expect(ranked.length).toBe(10);
    expect(ranked.every((item) => item.score >= 0 && item.score <= 100 && item.explanation.includes(item.momentum.toFixed(1)))).toBe(true);
  });

  it('calculates portfolio value and return from shares and cost basis', () => {
    const result = portfolioAnalytics([{ ticker: 'AAPL', shares: 2, cost_basis: 220 }]);
    expect(result.value).toBeCloseTo(474.98, 2);
    expect(result.cost).toBe(440);
    expect(result.totalReturn).toBeCloseTo(7.95, 2);
  });

  it('returns perfect correlation for identical return series', () => {
    expect(correlation([0.01, -0.02, 0.03], [0.01, -0.02, 0.03])).toBeCloseTo(1, 10);
  });
});
