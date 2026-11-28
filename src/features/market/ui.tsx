import { useId, type ReactNode } from "react";
import { Area, ComposedChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, ChevronRight, KeyRound, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { etTime, number, percent, shares, signal } from "./format";
import type { PricePoint } from "./quotes";
import type { Scored } from "./quant";
import type { Live } from "./market.functions";
import { SESSION_LABEL } from "./session";
import { useMarket } from "./live";

export function Change({ value }: { value: number }) {
  return (
    <span className={value >= 0 ? "positive" : "negative"}>
      {value >= 0 ? <ArrowUpRight className="inline size-3" /> : <ArrowDownRight className="inline size-3" />}{" "}
      {percent(value)}
    </span>
  );
}

/** "After hours $123.45 +0.4%" under a price, when the stock traded outside regular hours. */
export function ExtLine({ quote }: { quote: Pick<Scored, "ext"> }) {
  if (!quote.ext) return null;
  return (
    <div className="ext-line">
      {quote.ext.label} ${number(quote.ext.price)}{" "}
      <span className={quote.ext.change >= 0 ? "positive" : "negative"}>{percent(quote.ext.change)}</span>
    </div>
  );
}

export function Segments({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <Button key={o} variant="ghost" size="sm" aria-pressed={value === o} onClick={() => onChange(o)}>
          {o}
        </Button>
      ))}
    </div>
  );
}

/** The market's current state and when prices last refreshed, e.g. "AFTER HOURS · LIVE 4:12 PM ET". */
export function LiveLabel() {
  const { data } = useMarket();
  if (!data?.ok) return <span className="sample-label">NOT CONNECTED</span>;
  return (
    <span className="live-label" title="Prices refresh every 15 seconds">
      <span className={`status-dot ${data.session === "closed" ? "idle" : ""}`} />
      {SESSION_LABEL[data.session].toUpperCase()} · {etTime(data.asOf)}
    </span>
  );
}

export function Heading({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="toolbar">{children}</div>
    </div>
  );
}

export function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Shows `children` once live data has arrived; otherwise a loading state, or what to do when
 * the data connection isn't set up.
 */
export function LiveGate<T>({ result, loading, children }: { result: Live<T> | undefined; loading: boolean; children: (data: T) => ReactNode }) {
  if (result?.ok) return <>{children(result.data)}</>;
  if (!result) {
    return (
      <div className="empty flex items-center justify-center gap-2">
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Loading live market data…
          </>
        ) : (
          "Live market data could not be reached. It will retry automatically."
        )}
      </div>
    );
  }
  return <ConnectData reason={result.reason} message={result.message} />;
}

export function ConnectData({ reason, message }: { reason: string; message: string }) {
  return (
    <Panel title={reason === "missing-keys" ? "Connect live market data" : "Live market data unavailable"} action={<KeyRound className="size-4 text-muted-foreground" />}>
      <div className="panel-body text-xs text-muted-foreground leading-7">
        <p>{message}</p>
        {reason !== "unavailable" && (
          <ol className="list-decimal ml-5 mt-3">
            <li>
              Create a free account at{" "}
              <a className="text-primary underline" href="https://app.alpaca.markets/signup" target="_blank" rel="noreferrer">
                alpaca.markets
              </a>{" "}
              (paper trading is enough).
            </li>
            <li>In the Alpaca dashboard, open API Keys and generate a key.</li>
            <li>
              In Lovable, open Cloud → Secrets and add <code>ALPACA_API_KEY_ID</code> and <code>ALPACA_API_SECRET_KEY</code>.
            </li>
          </ol>
        )}
      </div>
    </Panel>
  );
}

export function Sparkline({ data, negative = false }: { data: number[]; negative?: boolean }) {
  return (
    <div className="sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((price) => ({ price }))}>
          <Line type="linear" dataKey="price" dot={false} stroke={negative ? "var(--negative)" : "var(--positive)"} strokeWidth={1.5} isAnimationActive={false} />
          <YAxis hide domain={["dataMin", "dataMax"]} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const dayLabel = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const timeLabel = (d: string) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const fullTimeLabel = (d: string) =>
  new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";

/** `intraday` points carry full timestamps; daily points carry "YYYY-MM-DD". */
export function PriceChart({ data, compare = false, tall = false, intraday = false }: { data: PricePoint[]; compare?: boolean; tall?: boolean; intraday?: boolean }) {
  const id = useId().replaceAll(":", "");
  const sameDay = intraday && data.length > 0 && data[0]!.date.slice(0, 10) === data.at(-1)!.date.slice(0, 10);
  if (!data.length) return <div className={`chart ${tall ? "chart-tall" : ""} empty grid place-items-center`}>No trades in this period yet.</div>;
  return (
    <div className={`chart ${tall ? "chart-tall" : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 15, right: 2, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--positive)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="var(--positive)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis
            dataKey="date"
            minTickGap={65}
            tickFormatter={(d) => (sameDay ? timeLabel(String(d)) : dayLabel(String(d)))}
            tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis orientation="right" domain={["auto", "auto"]} tickCount={5} width={57} tickFormatter={(n) => number(Number(n))} tick={{ fill: "var(--muted-foreground)", fontSize: 9, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="chart-tooltip">
                  <div className="text-muted-foreground mb-2">{intraday ? fullTimeLabel(String(label)) : dayLabel(String(label))}</div>
                  {payload.map((p, i) => (
                    <div key={i}>
                      {p.name}: {number(Number(p.value))}
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          <Area name="Price" dataKey="price" type="linear" stroke="var(--positive)" strokeWidth={1.8} fill={`url(#${id})`} isAnimationActive={false} />
          {compare && <Line name="Comparison" dataKey="benchmark" type="linear" stroke="var(--chart-secondary)" dot={false} strokeWidth={1.5} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StockTable({ rows, action }: { rows: Scored[]; action?: (s: Scored) => ReactNode }) {
  return (
    <div className="table-scroll">
      <table className="stock-table">
        <thead>
          <tr>
            <th>SYMBOL / COMPANY</th>
            <th className="text-right">PRICE</th>
            <th className="text-right">CHANGE</th>
            <th className="text-right">VOLUME</th>
            <th title="Based on the last 20 trading days, not just today's move">20-DAY SIGNAL</th>
            {action && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.ticker}>
              <td>
                <Link to="/research" search={{ ticker: s.ticker }}>
                  <div className="stock-symbol">{s.ticker}</div>
                  <div className="stock-name">{s.name}</div>
                </Link>
              </td>
              <td className="text-right">
                ${number(s.price)}
                <ExtLine quote={s} />
              </td>
              <td className="text-right">
                <Change value={s.change} />
              </td>
              <td className="text-right text-muted-foreground">{shares(s.volume)}</td>
              <td>
                <span className={`signal-pill ${signal(s.score).toLowerCase()}`}>{signal(s.score)}</span>
              </td>
              {action && <td>{action(s)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty">No stocks match your filters.</div>}
    </div>
  );
}

export function Stat({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="stat-item">
      <small>{label}</small>
      <strong className={positive ? "positive" : ""}>{value}</strong>
    </div>
  );
}

export function ViewLink({ to, label = "View all" }: { to: "/signals" | "/watchlist" | "/research"; label?: string }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      <Link to={to} search={{}} className="text-muted-foreground text-[10px]">
        {label}
        <ChevronRight />
      </Link>
    </Button>
  );
}

export function exportCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
