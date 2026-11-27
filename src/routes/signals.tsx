import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money, number, percent, signal } from '@/features/market/sample-data';
import { rankOpportunities } from '@/features/market/quant';
import { Change, Heading, Panel, SampleLabel, Stat, exportCsv } from '@/features/market/ui';
import { pageHead } from '@/features/market/metadata';

export const Route = createFileRoute('/signals')({
  head: () => pageHead('Trading Signals', 'Rank sample US equity opportunities by momentum, relative strength, volume anomalies, volatility, and technical structure.'),
  component: TradingSignals,
});

function TradingSignals() {
  const opportunities = rankOpportunities();
  const [sector, setSector] = useState('All sectors');
  const [cap, setCap] = useState('All market caps');
  const [volatility, setVolatility] = useState('All volatility');
  const [strength, setStrength] = useState('All signals');
  const [selected, setSelected] = useState(opportunities[0]?.ticker ?? '');
  const sectors = [...new Set(opportunities.map((item) => item.sector))].sort();
  const filtered = opportunities.filter((item) =>
    (sector === 'All sectors' || item.sector === sector) &&
    (cap === 'All market caps' || (cap === 'Large cap · $500B+' ? item.cap >= 500 : cap === 'Mid cap · $100–500B' ? item.cap >= 100 && item.cap < 500 : item.cap < 100)) &&
    (volatility === 'All volatility' || (volatility === 'Lower · under 20%' ? item.volatility < 20 : volatility === 'Moderate · 20–40%' ? item.volatility >= 20 && item.volatility <= 40 : item.volatility > 40)) &&
    (strength === 'All signals' || item.score >= Number(strength)),
  );
  const detail = opportunities.find((item) => item.ticker === selected) ?? filtered[0];
  const average = filtered.length ? filtered.reduce((sum, item) => sum + item.score, 0) / filtered.length : 0;
  return <>
    <Heading title="Trading signals" description="A transparent, multi-factor ranking of potential research opportunities."><SampleLabel /><Button variant="outline" size="sm" onClick={() => exportCsv('quantedge-sample-signals.csv', [['SAMPLE DATA — NOT LIVE'], ['Ticker', 'Score', 'Momentum %', 'Relative strength', 'Volume anomaly %', 'Volatility %'], ...filtered.map((item) => [item.ticker, item.score, item.momentum, item.relativeStrength, item.volumeAnomaly, item.volatility])])}><ArrowDownToLine />Export</Button></Heading>
    <div className="notice">Rankings are calculated from synthetic prices. They are research prompts, not recommendations or validated predictions.</div>
    <div className="stat-grid"><Stat label="Matching opportunities" value={String(filtered.length)} /><Stat label="Bullish signals" value={String(filtered.filter((item) => item.score >= 65).length)} positive /><Stat label="Average composite score" value={filtered.length ? average.toFixed(1) : '—'} /><Stat label="Highest-ranked ticker" value={filtered[0]?.ticker ?? '—'} positive={Boolean(filtered[0])} /></div>
    <Panel title="Universe filters" action={<ScanLine />}><div className="filter-grid">
      <label className="field">Sector<select value={sector} onChange={(event) => setSector(event.target.value)}><option>All sectors</option>{sectors.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="field">Market capitalization<select value={cap} onChange={(event) => setCap(event.target.value)}><option>All market caps</option><option>Large cap · $500B+</option><option>Mid cap · $100–500B</option><option>Small cap · under $100B</option></select></label>
      <label className="field">Annualized sample volatility<select value={volatility} onChange={(event) => setVolatility(event.target.value)}><option>All volatility</option><option>Lower · under 20%</option><option>Moderate · 20–40%</option><option>Higher · over 40%</option></select></label>
      <label className="field">Signal strength<select value={strength} onChange={(event) => setStrength(event.target.value)}><option>All signals</option><option value="65">65+ · bullish</option><option value="75">75+ · strong</option><option value="85">85+ · strongest</option></select></label>
    </div></Panel>
    <Panel title="Quantitative opportunity ranking" className="mt-5"><div className="table-scroll"><table className="stock-table"><thead><tr><th>RANK</th><th>SYMBOL</th><th className="text-right">PRICE</th><th className="text-right">DAY</th><th className="text-right">20D MOMENTUM</th><th className="text-right">REL. STRENGTH</th><th className="text-right">VOLUME ANOMALY</th><th className="text-right">VOLATILITY</th><th>SCORE / SIGNAL</th><th /></tr></thead><tbody>{filtered.map((item, index) => <tr key={item.ticker}><td className="text-muted-foreground">{String(index + 1).padStart(2, '0')}</td><td><Link to="/research" search={{ ticker: item.ticker }}><div className="stock-symbol">{item.ticker}</div><div className="stock-name">{item.name}</div></Link></td><td className="text-right">{money(item.price)}</td><td className="text-right"><Change value={item.change} /></td><td className={`text-right ${item.momentum >= 0 ? 'positive' : 'negative'}`}>{percent(item.momentum)}</td><td className={`text-right ${item.relativeStrength >= 0 ? 'positive' : 'negative'}`}>{number(item.relativeStrength)}</td><td className="text-right">{percent(item.volumeAnomaly)}</td><td className="text-right">{number(item.volatility)}%</td><td><span className="font-mono mr-2">{item.score}</span><span className={`signal-pill ${signal(item.score).toLowerCase()}`}>{signal(item.score)}</span></td><td><Button variant="ghost" size="sm" onClick={() => setSelected(item.ticker)}>Why?<ArrowUpRight /></Button></td></tr>)}</tbody></table>{!filtered.length && <div className="empty">No stocks match these filters.</div>}</div></Panel>
    {detail && <Panel title={`Why ${detail.ticker} ranked ${detail.score}/100`} className="mt-5"><div className="panel-body opportunity-explanation"><p>{detail.explanation}</p><div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-[10px] text-muted-foreground"><span>RSI and moving averages contribute to technical structure.</span><span>Higher volatility reduces the composite score.</span><span>No news or fundamental data is included.</span></div></div></Panel>}
  </>;
}
