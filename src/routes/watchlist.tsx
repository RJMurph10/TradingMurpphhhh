import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStock, money, number, sampleHistory, signal } from '@/features/market/sample-data';
import { indicators } from '@/features/market/quant';
import { Change, Heading, Panel, SampleLabel, Sparkline, Stat } from '@/features/market/ui';
import { pageHead } from '@/features/market/metadata';
import { useResearch } from '@/features/collections/research-context';

export const Route = createFileRoute('/watchlist')({
  head: () => pageHead('Watchlist', 'Track sample prices, quantitative signals, momentum, RSI, and moving averages for your saved QuantEdge watchlist.'),
  component: Watchlist,
});

function Watchlist() {
  const research = useResearch();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const rows = research.watchlist.flatMap((ticker) => {
    const stock = getStock(ticker);
    if (!stock) return [];
    const history = sampleHistory(ticker);
    return [{ stock, history, technical: indicators(history) }];
  });
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const ticker = input.trim().toUpperCase();
    if (!getStock(ticker)) { setError('Enter a ticker from the sample universe, such as NVDA, AAPL, MSFT, SPY, or QQQ.'); return; }
    setError('');
    if (!research.watchlist.includes(ticker)) await research.toggleWatch(ticker);
    setInput('');
  };
  return <>
    <Heading title="Watchlist" description="Monitor price action and technical structure across your saved research universe."><SampleLabel /></Heading>
    {!research.email && <div className="notice">You are using a demonstration watchlist. <Button variant="link" size="sm" onClick={research.openAuth}>Sign in</Button> to save your own list.</div>}
    <div className="stat-grid"><Stat label="Tracked tickers" value={String(rows.length)} /><Stat label="Bullish signals" value={String(rows.filter(({ stock }) => stock.score >= 65).length)} positive /><Stat label="Advancing today" value={String(rows.filter(({ stock }) => stock.change >= 0).length)} /><Stat label="Average sample score" value={rows.length ? (rows.reduce((sum, row) => sum + row.stock.score, 0) / rows.length).toFixed(1) : '—'} /></div>
    <Panel title="Add a stock or ETF"><form className="watchlist-add" onSubmit={add}><input aria-label="Watchlist ticker" placeholder="Ticker symbol" value={input} onChange={(event) => setInput(event.target.value.toUpperCase())} maxLength={5} /><Button type="submit" disabled={research.loading}><Plus />Add to watchlist</Button><span className="text-[10px] text-muted-foreground">Available: {['NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'TSLA', 'JPM', 'UNH', 'XOM', 'SPY', 'QQQ', 'AMD'].join(' · ')}</span></form>{error && <div role="alert" className="notice mx-5">{error}</div>}</Panel>
    <Panel title="Your research list" className="mt-5"><div className="table-scroll"><table className="stock-table"><thead><tr><th>SYMBOL / COMPANY</th><th>30-SESSION TREND</th><th className="text-right">PRICE</th><th className="text-right">DAY CHANGE</th><th className="text-right">RSI (14)</th><th className="text-right">20D AVG.</th><th>SIGNAL</th><th /></tr></thead><tbody>{rows.map(({ stock, history, technical }) => <tr key={stock.ticker}><td><div className="stock-symbol">{stock.ticker}</div><div className="stock-name">{stock.name}</div></td><td><div className="w-24"><Sparkline data={history.slice(-30).map((point) => point.price)} negative={history.at(-1)!.price < history.at(-30)!.price} /></div></td><td className="text-right">{money(stock.price)}</td><td className="text-right"><Change value={stock.change} /></td><td className="text-right">{number(technical.rsi)}</td><td className={`text-right ${technical.last >= technical.ma20 ? 'positive' : 'negative'}`}>{money(technical.ma20)}</td><td><span className={`signal-pill ${signal(stock.score).toLowerCase()}`}>{signal(stock.score)}</span></td><td><Button variant="ghost" size="icon" aria-label={`Remove ${stock.ticker}`} onClick={() => void research.toggleWatch(stock.ticker)}><Trash2 /></Button></td></tr>)}</tbody></table>{!rows.length && <div className="empty">Your watchlist is empty. Add a ticker above to begin.</div>}</div></Panel>
    <p className="mt-4 text-[10px] text-muted-foreground">Prices, trends, and indicators are illustrative sample data. No live quote feed is connected.</p>
  </>;
}
