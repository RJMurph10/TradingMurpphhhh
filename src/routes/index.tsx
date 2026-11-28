import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Activity, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { etTime, number, percent, signal } from "@/features/market/format";
import { INDEX_FUNDS, SECTOR_FUNDS, STOCKS } from "@/features/market/universe";
import { useHistory, useIntraday, useMarket, useNews, useQuotes, dataOf } from "@/features/market/live";
import type { Scored } from "@/features/market/quant";
import { Heading, LiveLabel, LiveGate, Segments, Panel, Change, ExtLine, Sparkline, PriceChart, StockTable, ViewLink, exportCsv } from "@/features/market/ui";
import { pageHead } from "@/features/market/metadata";
import { useResearch } from "@/features/collections/research-context";

export const Route = createFileRoute("/")({
  head: () => pageHead("Market Overview", "Live US market indices, sector performance, breadth and quantitative opportunities in TradingMurpphhhh."),
  component: Dashboard,
});

/** Sessions shown for each daily chart range. */
const SESSIONS: Record<string, number> = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252 };

function Dashboard() {
  const market = useMarket();
  return (
    <>
      <Heading title="Market overview" description="A quantitative perspective on the US equity market.">
        <LiveLabel />
        <Button
          variant="outline"
          size="sm"
          disabled={!market.data?.ok}
          onClick={() => {
            const rows = dataOf(market.data) ?? [];
            exportCsv("tradingmurpphhhh-market.csv", [
              [`Exported ${new Date().toISOString()}`],
              ["Ticker", "Name", "Price", "Change %", "Volume"],
              ...rows.map((q) => [q.ticker, q.name, q.price, q.change, q.volume]),
            ]);
          }}
        >
          <ArrowDownToLine />
          Export
        </Button>
      </Heading>
      <LiveGate result={market.data} loading={market.isLoading}>
        {(quotes) => <DashboardBody quotes={quotes} />}
      </LiveGate>
    </>
  );
}

function DashboardBody({ quotes }: { quotes: Scored[] }) {
  const [chartPeriod, setChartPeriod] = useState("1D");
  const [index, setIndex] = useState("SPY");
  const [tab, setTab] = useState("Top gainers");
  const bySymbol = new Map(quotes.map((q) => [q.ticker, q]));
  const indexCards = INDEX_FUNDS.flatMap((f) => {
    const q = bySymbol.get(f.ticker);
    return q ? [{ ...f, q }] : [];
  });
  const idx = bySymbol.get(index);
  const stocks = STOCKS.flatMap((s) => bySymbol.get(s.ticker) ?? []);
  const sectors = SECTOR_FUNDS.flatMap((f) => {
    const q = bySymbol.get(f.ticker);
    return q ? [{ name: f.label, change: q.change }] : [];
  });
  const movers = [...stocks]
    .sort((a, b) => (tab === "Top losers" ? a.change - b.change : tab === "Most active" ? b.volume * b.price - a.volume * a.price : b.change - a.change))
    .slice(0, 5);
  const advancing = stocks.filter((s) => s.change > 0).length;
  const declining = stocks.filter((s) => s.change < 0).length;
  const highs = stocks.filter((s) => s.price >= s.high52 * 0.98).length;
  const lows = stocks.filter((s) => s.price <= s.low52 * 1.02).length;
  const breadth = stocks.length ? Math.round((advancing / stocks.length) * 100) : 0;
  const vix = bySymbol.get("VIXY");

  return (
    <>
      <div className="index-grid">
        {indexCards.map(({ ticker, tracks, q }) => (
          <Link key={ticker} to="/research" search={{ ticker }} className="index-card">
            <div className="index-label">
              <span>{tracks}</span>
              <span className="font-mono text-[9px]">{ticker}</span>
            </div>
            <div className="index-value">{number(q.price)}</div>
            <div className="index-change">
              <Change value={q.change} />
              <span className="text-muted-foreground ml-2">
                {q.price - q.prevClose >= 0 ? "+" : ""}
                {number(q.price - q.prevClose)}
              </span>
            </div>
            <ExtLine quote={q} />
            <Sparkline data={q.spark} negative={(q.spark.at(-1) ?? 0) < (q.spark[0] ?? 0)} />
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <div>
          <Panel
            title="Market performance"
            action={
              <div className="flex gap-2 items-center">
                <span className="text-[10px] text-muted-foreground hidden md:block">Index</span>
                <select aria-label="Market index" className="!py-1 !text-[10px]" value={index} onChange={(e) => setIndex(e.target.value)}>
                  {INDEX_FUNDS.map((i) => (
                    <option key={i.ticker} value={i.ticker}>
                      {i.tracks} ({i.ticker})
                    </option>
                  ))}
                </select>
              </div>
            }
          >
            <div className="panel-body">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="chart-summary">
                  <strong>{idx ? number(idx.price) : "—"}</strong>
                  {idx && <Change value={idx.change} />}
                </div>
                <Segments options={["1D", "1W", "1M", "3M", "6M", "1Y"]} value={chartPeriod} onChange={setChartPeriod} />
              </div>
              <IndexChart symbol={index} period={chartPeriod} />
            </div>
            <div className="chart-footer">
              <div className="legend">
                <span>
                  <i />
                  {INDEX_FUNDS.find((f) => f.ticker === index)?.name}
                </span>
                <span>{chartPeriod === "1D" || chartPeriod === "1W" ? "Includes pre-market and after-hours" : "Daily closes"}</span>
              </div>
              <span>USD · Alpaca market data</span>
            </div>
          </Panel>
          <div className="lower-grid">
            <Panel title="Market movers" action={<ViewLink to="/signals" />}>
              <div className="px-3 pb-3">
                <Segments options={["Top gainers", "Top losers", "Most active"]} value={tab} onChange={setTab} />
              </div>
              <StockTable rows={movers} />
              <p className="px-5 pb-4 text-[9px] text-muted-foreground">Among {stocks.length} large US companies we track.</p>
            </Panel>
            <Panel title="Sector performance" action={<span className="text-[10px] text-muted-foreground">Today</span>}>
              <div className="panel-body">
                <div className="heatmap">
                  {sectors.map((s) => (
                    <div className="heat-tile" data-negative={s.change < 0} key={s.name}>
                      <span>{s.name}</span>
                      <strong>{percent(s.change)}</strong>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] text-muted-foreground mt-4">Each tile is that sector's SPDR fund (for example XLK for technology).</div>
              </div>
            </Panel>
          </div>
        </div>
        <div className="right-column">
          <Panel title="Market breadth" action={<Activity />}>
            <div className="panel-body">
              <div className="breadth-stats">
                <div>
                  <small>Advancing</small>
                  <strong className="positive">{advancing}</strong>
                </div>
                <div>
                  <small>Declining</small>
                  <strong className="negative">{declining}</strong>
                </div>
                <div>
                  <small>Near 52-week high</small>
                  <strong>{highs}</strong>
                </div>
                <div>
                  <small>Near 52-week low</small>
                  <strong>{lows}</strong>
                </div>
              </div>
              <div className="breadth-bar">
                <span style={{ width: `${breadth}%` }} />
              </div>
              <div className="breadth-legend">
                <span>{breadth}% advancing</span>
                <span>{stocks.length ? 100 - breadth : 0}% not advancing</span>
              </div>
              <div className="signal-summary">
                <div className={`signal-ring ${breadth >= 50 ? "positive" : "negative"}`}>{breadth}</div>
                <div>
                  <h3 className={breadth >= 60 ? "positive" : breadth <= 40 ? "negative" : ""}>
                    {breadth >= 60 ? "Risk-on sentiment" : breadth <= 40 ? "Risk-off sentiment" : "Mixed sentiment"}
                  </h3>
                  <p>Share of tracked stocks that are up</p>
                  <p>{breadth >= 60 ? "Broad participation in gains" : breadth <= 40 ? "Most stocks are falling" : "No clear direction"}</p>
                </div>
              </div>
              {vix && (
                <div className="flex justify-between text-[10px] text-muted-foreground border-t border-border pt-3">
                  <span>Fear gauge (VIXY)</span>
                  <Change value={vix.change} />
                </div>
              )}
            </div>
          </Panel>
          <NewsPanel />
        </div>
      </div>
      <Radar quotes={bySymbol} />
    </>
  );
}

function IndexChart({ symbol, period }: { symbol: string; period: string }) {
  const intraday = period === "1D" || period === "1W";
  const intra = useIntraday(symbol, period === "1W" ? "1W" : "1D", intraday);
  const daily = useHistory(intraday ? [] : [symbol]);
  if (intraday) {
    return <LiveGate result={intra.data} loading={intra.isLoading}>{(points) => <PriceChart data={points} intraday />}</LiveGate>;
  }
  return (
    <LiveGate result={daily.data} loading={daily.isLoading}>
      {(h) => <PriceChart data={(h[symbol] ?? []).slice(-(SESSIONS[period] ?? 252))} />}
    </LiveGate>
  );
}

function NewsPanel() {
  const news = useNews();
  const items = dataOf(news.data) ?? [];
  return (
    <Panel title="Market news" action={<Globe2 />} className="mt-5 lg:mt-5">
      <div className="panel-body">
        {items.slice(0, 5).map((n) => (
          <article className="news-item" key={n.id}>
            {n.symbols.length > 0 && <span className="text-[8px] text-primary font-medium">{n.symbols.slice(0, 4).join(" · ")}</span>}
            <h3 className="mt-1">
              <a href={n.url} target="_blank" rel="noreferrer" className="hover:underline">
                {n.headline}
              </a>
            </h3>
            <div className="news-meta">
              <span className="capitalize">{n.source}</span>
              <span>·</span>
              <span>{etTime(n.created_at)}</span>
            </div>
          </article>
        ))}
        {!items.length && <div className="text-[10px] text-muted-foreground">{news.isLoading ? "Loading headlines…" : "No headlines right now."}</div>}
        <div className="text-[9px] text-muted-foreground border-t border-border pt-3">Headlines from Benzinga via Alpaca</div>
      </div>
    </Panel>
  );
}

function Radar({ quotes }: { quotes: Map<string, Scored> }) {
  const r = useResearch();
  const watched = r.watchlist.slice(0, 3);
  const missing = watched.filter((t) => !quotes.has(t));
  const extra = useQuotes(missing);
  const extras = new Map((dataOf(extra.data) ?? []).map((q) => [q.ticker, q]));
  const rows = watched.flatMap((t) => quotes.get(t) ?? extras.get(t) ?? []);
  return (
    <div className="mt-5">
      <Panel title="On your radar" action={<ViewLink to="/watchlist" label="Open watchlist" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
          {rows.map((s) => (
            <Link key={s.ticker} to="/research" search={{ ticker: s.ticker }} className="px-5 pb-5 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-medium">{s.ticker}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">${number(s.price)}</span>
                <span className="ml-2 text-[10px]">
                  <Change value={s.change} />
                </span>
                <div className="text-[11px] text-muted-foreground mt-2">
                  Quantitative score{" "}
                  <span className="text-primary font-mono ml-2">
                    {s.score}/100 · {signal(s.score)}
                  </span>
                </div>
              </div>
              <ArrowUpRight className="size-4 text-primary" />
            </Link>
          ))}
          {!rows.length && <div className="px-5 pb-5 text-[11px] text-muted-foreground">Add stocks to your watchlist to see them here.</div>}
        </div>
      </Panel>
    </div>
  );
}
