import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { money, number, signal } from '@/features/market/format';
import { isTicker } from '@/features/market/universe';
import { dataOf, useQuotes } from '@/features/market/live';
import { Change, ExtLine, Heading, LiveGate, LiveLabel, Panel, Sparkline, Stat } from '@/features/market/ui';
import { pageHead } from '@/features/market/metadata';
import { useResearch } from '@/features/collections/research-context';

export const Route = createFileRoute('/watchlist')({
  head: () => pageHead('Watchlist', 'Track live prices, quantitative signals, momentum, RSI, and moving averages for your saved TradingMurpphhhh watchlist.'),
  component: Watchlist,
});

function Watchlist() {
  const research = useResearch();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const quotesQ = useQuotes(research.watchlist);
  const quotes = new Map((dataOf(quotesQ.data) ?? []).map((q) => [q.ticker, q]));
  const rows = research.watchlist.flatMap((ticker) => {
    const stock = quotes.get(ticker);
    return stock ? [{ stock }] : [];
  });
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const ticker = input.trim().toUpperCase();
    if (!isTicker(ticker)) { setError('Enter a US stock or ETF ticker of 1 to 5 letters, such as NVDA, AAPL or SPY.'); return; }
    setError('');
    if (!research.watchlist.includes(ticker)) await research.toggleWatch(ticker);
    setInput('');
  };
  return <>
    <Heading title="Watchlist" description="Monitor price action and technical structure across your saved research universe."><LiveLabel /></Heading>
    {!research.email && <div className="notice">You are using a demonstration watchlist. <Button variant="link" size="sm" onClick={research.openAuth}>Sign in</Button> to save your own list.</div>}
    <div className="stat-grid"><Stat label="Tracked tickers" value={String(rows.length)} /><Stat label="Bullish signals" value={String(rows.filter(({ stock }) => stock.score >= 65).length)} positive /><Stat label="Advancing today" value={String(rows.filter(({ stock }) => stock.change >= 0).length)} /><Stat label="Average score" value={rows.length ? (rows.reduce((sum, row) => sum + row.stock.score, 0) / rows.length).toFixed(1) : '—'} /></div>
    <Panel title="Add a stock or ETF"><form className="watchlist-add" onSubmit={add}><input aria-label="Watchlist ticker" placeholder="Ticker symbol" value={input} onChange={(event) => setInput(event.target.value.toUpperCase())} maxLength={5} /><Button type="submit" disabled={research.loading}><Plus />Add to watchlist</Button><span className="text-[10px] text-muted-foreground">Any US stock or ETF ticker</span></form>{error && <div role="alert" className="notice mx-5">{error}</div>}</Panel>
    <Panel title="Your research list" className="mt-5"><div className="table-scroll"><table className="stock-table"><thead><tr><th>SYMBOL / COMPANY</th><th>30-SESSION TREND</th><th className="text-right">PRICE</th><th className="text-right">DAY CHANGE</th><th className="text-right">RSI (14)</th><th className="text-right">20D AVG.</th><th>SIGNAL</th><th /></tr></thead><tbody>{rows.map(({ stock }) => <tr key={stock.ticker}><td><div className="stock-symbol">{stock.ticker}</div><div className="stock-name">{stock.name}</div></td><td><div className="w-24"><Sparkline data={stock.spark} negative={(stock.spark.at(-1) ?? 0) < (stock.spark[0] ?? 0)} /></div></td><td className="text-right">{money(stock.price)}<ExtLine quote={stock} /></td><td className="text-right"><Change value={stock.change} /></td><td className="text-right">{number(stock.rsi)}</td><td className={`text-right ${stock.price >= stock.ma20 ? 'positive' : 'negative'}`}>{money(stock.ma20)}</td><td><span className={`signal-pill ${signal(stock.score).toLowerCase()}`}>{signal(stock.score)}</span></td><td><Button variant="ghost" size="icon" aria-label={`Remove ${stock.ticker}`} onClick={() => void research.toggleWatch(stock.ticker)}><Trash2 /></Button></td></tr>)}</tbody></table>{!rows.length && (quotesQ.data && !quotesQ.data.ok ? <LiveGate result={quotesQ.data} loading={false}>{() => null}</LiveGate> : <div className="empty">{research.watchlist.length && quotesQ.isLoading ? 'Loading live prices…' : 'Your watchlist is empty. Add a ticker above to begin.'}</div>)}</div></Panel>
    <p className="mt-4 text-[10px] text-muted-foreground">Prices refresh every 15 seconds, including pre-market and after-hours trades. Trends and indicators use real daily closes.</p>
  </>;
}
