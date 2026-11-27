import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowDownToLine, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStock, money, number, percent, stocks } from '@/features/market/sample-data';
import { portfolioAnalytics } from '@/features/market/portfolio';
import { Heading, Panel, PriceChart, SampleLabel, Stat, exportCsv } from '@/features/market/ui';
import { pageHead } from '@/features/market/metadata';
import { useResearch } from '@/features/collections/research-context';

export const Route = createFileRoute('/portfolio')({
  head: () => pageHead('Portfolio Analytics', 'Analyze a hypothetical portfolio with allocation, sector exposure, drawdown, volatility, Sharpe ratio, correlations, and a sample benchmark.'),
  component: Portfolio,
});

function Portfolio() {
  const research = useResearch();
  const [ticker, setTicker] = useState('AAPL');
  const [shares, setShares] = useState('10');
  const [costBasis, setCostBasis] = useState('200');
  const [error, setError] = useState('');
  const analytics = portfolioAnalytics(research.holdings);
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(shares);
    const basis = Number(costBasis);
    if (!getStock(ticker) || !(amount > 0) || !(basis > 0)) { setError('Choose a valid ticker and enter positive shares and cost basis.'); return; }
    setError('');
    await research.addHolding({ ticker, shares: amount, cost_basis: basis });
  };
  return <>
    <Heading title="Portfolio analytics" description="Measure allocation, performance, and risk in a hypothetical portfolio."><SampleLabel /><Button variant="outline" size="sm" disabled={!analytics.positions.length} onClick={() => exportCsv('quantedge-sample-portfolio.csv', [['SAMPLE DATA — NOT LIVE'], ['Ticker', 'Shares', 'Cost basis', 'Sample price', 'Value', 'Weight %', 'Return %'], ...analytics.positions.map((position) => [position.ticker, position.shares, position.cost_basis, position.stock.price, position.value, analytics.value ? position.value / analytics.value * 100 : 0, (position.stock.price / position.cost_basis - 1) * 100])])}><ArrowDownToLine />Export</Button></Heading>
    {!research.email && <div className="notice">You are using a demonstration portfolio. <Button variant="link" size="sm" onClick={research.openAuth}>Sign in</Button> to save your own holdings.</div>}
    <div className="stat-grid"><Stat label="Portfolio value" value={money(analytics.value)} /><Stat label="Daily performance" value={`${analytics.dayChange >= 0 ? '+' : ''}${money(analytics.dayChange)} · ${percent(analytics.dayReturn)}`} positive={analytics.dayChange > 0} /><Stat label="Total return vs. cost" value={percent(analytics.totalReturn)} positive={analytics.totalReturn > 0} /><Stat label="Sample SPY period return" value={percent(analytics.benchmarkReturn)} /></div>
    <Panel title="Add or update a hypothetical holding"><form className="portfolio-form" onSubmit={add}><label className="field">Stock / ETF<select value={ticker} onChange={(event) => setTicker(event.target.value)}>{stocks.map((stock) => <option key={stock.ticker}>{stock.ticker}</option>)}</select></label><label className="field">Shares<input type="number" min="0.0001" step="any" required value={shares} onChange={(event) => setShares(event.target.value)} /></label><label className="field">Average cost basis ($)<input type="number" min="0.01" step="any" required value={costBasis} onChange={(event) => setCostBasis(event.target.value)} /></label><Button type="submit" disabled={research.loading}><Plus />Save holding</Button></form>{error && <div role="alert" className="notice mx-5">{error}</div>}</Panel>
    <div className="portfolio-grid mt-5"><Panel title="Hypothetical equity curve"><div className="panel-body"><PriceChart data={analytics.curve} compare tall /><div className="legend mt-3"><span><i />Current-share portfolio</span><span><i />SPY sample proxy · rebased</span></div></div></Panel><Panel title="Asset allocation"><div className="panel-body allocation-list">{analytics.positions.map((position) => { const weight = analytics.value ? position.value / analytics.value * 100 : 0; return <div className="allocation-row" key={position.ticker}><div><strong>{position.ticker}</strong><span>{weight.toFixed(1)}%</span></div><div className="allocation-track"><span style={{ width: `${weight}%` }} /></div><small>{money(position.value)}</small></div>; })}{!analytics.positions.length && <div className="empty">Add a holding to see allocation.</div>}</div></Panel></div>
    <div className="stat-grid mt-5"><Stat label="Annualized sample volatility" value={`${number(analytics.volatility)}%`} /><Stat label="Maximum drawdown" value={`${number(analytics.maxDrawdown)}%`} /><Stat label="Sharpe ratio · 0% risk-free" value={number(analytics.sharpe)} /><Stat label="Sector exposures" value={String(analytics.sectorExposure.length)} /></div>
    <div className="lower-grid"><Panel title="Sector exposure"><div className="panel-body allocation-list">{analytics.sectorExposure.map((sector) => <div className="allocation-row" key={sector.sector}><div><strong>{sector.sector}</strong><span>{sector.weight.toFixed(1)}%</span></div><div className="allocation-track"><span style={{ width: `${sector.weight}%` }} /></div><small>{money(sector.amount)}</small></div>)}</div></Panel><Panel title="Risk methodology"><div className="panel-body text-xs text-muted-foreground leading-7"><p>Metrics use synthetic daily closes and current share counts. Volatility and Sharpe ratio are annualized with 252 sessions. Maximum drawdown measures peak-to-trough declines in the sample equity curve.</p><p className="mt-4">Benchmark values are rebased to the portfolio’s initial sample value. This is not actual account performance.</p></div></Panel></div>
    <Panel title="Holdings" className="mt-5"><div className="table-scroll"><table className="stock-table"><thead><tr><th>SYMBOL</th><th className="text-right">SHARES</th><th className="text-right">AVG. COST</th><th className="text-right">SAMPLE PRICE</th><th className="text-right">MARKET VALUE</th><th className="text-right">WEIGHT</th><th className="text-right">RETURN</th><th /></tr></thead><tbody>{analytics.positions.map((position) => <tr key={position.ticker}><td><div className="stock-symbol">{position.ticker}</div><div className="stock-name">{position.stock.name}</div></td><td className="text-right">{number(position.shares)}</td><td className="text-right">{money(position.cost_basis)}</td><td className="text-right">{money(position.stock.price)}</td><td className="text-right">{money(position.value)}</td><td className="text-right">{number(analytics.value ? position.value / analytics.value * 100 : 0)}%</td><td className={`text-right ${position.stock.price >= position.cost_basis ? 'positive' : 'negative'}`}>{percent((position.stock.price / position.cost_basis - 1) * 100)}</td><td><Button variant="ghost" size="icon" aria-label={`Remove ${position.ticker}`} onClick={() => void research.removeHolding(position.ticker)}><Trash2 /></Button></td></tr>)}</tbody></table>{!analytics.positions.length && <div className="empty">No holdings yet.</div>}</div></Panel>
    <Panel title="Return correlation between holdings" className="mt-5"><div className="table-scroll"><table className="stock-table correlation-table"><thead><tr><th>TICKER</th>{analytics.positions.map((position) => <th className="text-right" key={position.ticker}>{position.ticker}</th>)}</tr></thead><tbody>{analytics.correlations.map((row) => <tr key={row.ticker}><td className="stock-symbol">{row.ticker}</td>{row.values.map((value, i) => <td className="text-right" key={analytics.positions[i]?.ticker}>{value === null ? '—' : value.toFixed(2)}</td>)}</tr>)}</tbody></table>{!analytics.positions.length && <div className="empty">Correlations appear after adding holdings.</div>}</div></Panel>
  </>;
}
