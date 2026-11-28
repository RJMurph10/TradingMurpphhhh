import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Plus, Check, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, number, shares } from "@/features/market/format";
import { PICKER_SYMBOLS, isTicker } from "@/features/market/universe";
import { indicators } from "@/features/market/quant";
import { dataOf, useHistory, useIntraday, useQuotes } from "@/features/market/live";
import { Heading, LiveLabel, LiveGate, Segments, Panel, Change, ExtLine, PriceChart, Stat } from "@/features/market/ui";
import { pageHead } from "@/features/market/metadata";
import { useResearch } from "@/features/collections/research-context";

export const Route = createFileRoute("/research")({
  validateSearch: (s: Record<string, unknown>): { ticker?: string } => (typeof s["ticker"] === "string" ? { ticker: s["ticker"] } : {}),
  head: () => pageHead("Stock Research", "Live prices, price history, moving averages, RSI, MACD and volatility for any US stock in TradingMurpphhhh."),
  component: Research,
});

const SESSIONS: Record<string, number> = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252, "2Y": 504 };

function Research() {
  const search = Route.useSearch();
  const [ticker, setTicker] = useState((search.ticker ?? "NVDA").toUpperCase());
  const [input, setInput] = useState(ticker);
  const [period, setPeriod] = useState("1Y");
  const [compare, setCompare] = useState("");
  const r = useResearch();
  useEffect(() => {
    if (search.ticker) {
      setTicker(search.ticker.toUpperCase());
      setInput(search.ticker.toUpperCase());
    }
  }, [search.ticker]);
  const valid = isTicker(ticker);
  const quoteQ = useQuotes(valid ? [ticker] : []);
  const historyQ = useHistory(valid ? [ticker, ...(compare ? [compare] : [])] : []);
  const intraday = period === "1D" || period === "1W";
  const intraQ = useIntraday(ticker, period === "1W" ? "1W" : "1D", valid && intraday);
  const stock = dataOf(quoteQ.data)?.[0];
  const histories = dataOf(historyQ.data);
  const history = histories?.[ticker] ?? [];
  const x = indicators(history);
  const data = history.slice(-(SESSIONS[period] ?? 252));
  const other = compare ? (histories?.[compare] ?? []) : [];
  const otherByDate = new Map(other.map((p) => [p.date, p.price]));
  const first = data[0]?.price ?? 1;
  const otherFirst = otherByDate.get(data[0]?.date ?? "") ?? other[0]?.price ?? 1;
  const chart = data.map((p) => ({ ...p, benchmark: ((otherByDate.get(p.date) ?? otherFirst) / otherFirst) * first }));

  return (
    <>
      <Heading title="Stock research" description="Price action, technical structure, and quantitative risk.">
        <LiveLabel />
        <Button variant="outline" size="sm" disabled={!stock} onClick={() => void r.toggleWatch(ticker)}>
          {r.watchlist.includes(ticker) ? <Check /> : <Plus />}
          {r.watchlist.includes(ticker) ? "Watching" : "Watch stock"}
        </Button>
      </Heading>
      <form
        className="flex flex-wrap gap-3 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          setTicker(input.trim().toUpperCase());
        }}
      >
        <input aria-label="Research ticker" placeholder="Any US ticker, e.g. AAPL" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit">
          <Search />
          Analyze
        </Button>
        <select aria-label="Compare stock" value={compare} onChange={(e) => setCompare(e.target.value)} disabled={intraday}>
          <option value="">Compare with…</option>
          {PICKER_SYMBOLS.filter((s) => s !== ticker).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </form>
      <LiveGate result={quoteQ.data} loading={quoteQ.isLoading}>
        {() =>
          !stock ? (
            <Panel title="Ticker not found">
              <div className="empty">{valid ? `No US market data for ${ticker}. Check the symbol and try again.` : "Enter a ticker of 1 to 5 letters, like AAPL."}</div>
            </Panel>
          ) : (
            <>
              <div className="flex gap-4 items-center mb-6">
                <div className="size-12 bg-secondary rounded-md grid place-items-center font-mono text-primary">{ticker.slice(0, 2)}</div>
                <div>
                  <h2 className="text-xl">{stock.name}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ticker} · US equity · {stock.sector}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <strong className="font-mono text-2xl font-medium">{money(stock.price)}</strong>
                  <div className="text-xs mt-1">
                    <Change value={stock.change} />
                  </div>
                  <ExtLine quote={stock} />
                </div>
              </div>
              <div className="stat-grid">
                <Stat label="Previous close" value={money(stock.prevClose)} />
                <Stat label="Day range" value={stock.dayLow !== null && stock.dayHigh !== null ? `${number(stock.dayLow)} – ${number(stock.dayHigh)}` : "—"} />
                <Stat label="52-week range" value={`${number(stock.low52)} – ${number(stock.high52)}`} />
                <Stat label="Volume (15-min delay)" value={shares(stock.volume)} />
              </div>
              <Panel title={`${ticker} · Price history`} action={<Segments options={["1D", "1W", "1M", "3M", "6M", "1Y", "2Y"]} value={period} onChange={setPeriod} />}>
                <div className="panel-body">
                  {intraday ? (
                    <LiveGate result={intraQ.data} loading={intraQ.isLoading}>
                      {(points) => <PriceChart data={points} intraday tall />}
                    </LiveGate>
                  ) : (
                    <LiveGate result={historyQ.data} loading={historyQ.isLoading}>
                      {() => <PriceChart data={chart} compare={Boolean(compare)} tall />}
                    </LiveGate>
                  )}
                  <div className="legend mt-3">
                    <span>
                      <i />
                      {ticker}
                    </span>
                    {compare && !intraday && (
                      <span>
                        <i />
                        {compare} · rebased to {ticker}
                      </span>
                    )}
                    {intraday && <span>Every {period === "1D" ? "5" : "30"} minutes · includes pre-market and after-hours</span>}
                  </div>
                </div>
              </Panel>
              <div className="lower-grid">
                <Panel title="Technical indicators">
                  <div className="table-scroll">
                    <table className="stock-table">
                      <thead>
                        <tr>
                          <th>INDICATOR</th>
                          <th>VALUE</th>
                          <th>WHAT IT MEANS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["20-day moving average", money(x.ma20), x.last > x.ma20 ? "Price above its 1-month average" : "Price below its 1-month average"],
                          ["50-day moving average", money(x.ma50), "Intermediate trend"],
                          ["100-day moving average", money(x.ma100), "Longer-term trend"],
                          ["200-day moving average", money(x.ma200), x.last > x.ma200 ? "Above the long-term baseline" : "Below the long-term baseline"],
                          ["RSI (14)", number(x.rsi), x.rsi > 70 ? "Overbought: rose fast, may cool off" : x.rsi < 30 ? "Oversold: fell fast, may bounce" : "Neutral range"],
                          ["MACD (simple)", number(x.macd), x.macd >= 0 ? "Short-term momentum up" : "Short-term momentum down"],
                          ["Bollinger Bands", `${money(x.lower)} – ${money(x.upper)}`, "Typical 20-day price range"],
                          ["Average daily move", money(x.atr), "Typical close-to-close swing"],
                          ["Annualized volatility", `${number(x.volatility)}%`, "How bumpy the ride has been"],
                          ["Sharpe ratio", number(x.sharpe), "Return per unit of risk, over two years"],
                        ].map((row) => (
                          <tr key={row[0]}>
                            {row.map((v, i) => (
                              <td key={i} className={i === 2 ? "text-muted-foreground" : ""}>
                                {v}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <Panel title="Research assessment">
                  <div className="panel-body">
                    <h3 className="text-primary text-lg mb-3">{stock.score >= 65 ? "Positive technical structure" : stock.score <= 45 ? "Weak technical structure" : "Mixed technical structure"}</h3>
                    <p className="text-xs text-muted-foreground leading-7">{stock.explanation}</p>
                    <div className="info-note mt-5">Indicators use real daily closing prices from the last two years. They describe what price has done, not what it will do.</div>
                    <Button variant="outline" asChild>
                      <Link to="/predictions">
                        Evaluate models <ArrowUpRight />
                      </Link>
                    </Button>
                  </div>
                </Panel>
              </div>
            </>
          )
        }
      </LiveGate>
    </>
  );
}
