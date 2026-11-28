import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, ArrowDownRight, ArrowUpRight, Radar, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, percent } from "@/features/market/format";
import { dataOf, useEdges, usePickResults } from "@/features/market/live";
import { usePaperPicks } from "@/features/market/picks";
import {
  GAP_MIN,
  HOLD_DAYS,
  VOLUME_MIN,
  pct,
  pickRecord,
  type Board,
  type EdgeRow,
  type Lean,
  type PaperPick,
  type PickResult,
  type Rate,
} from "@/features/market/edges";
import { Heading, LiveGate, LiveLabel, Panel, Stat, exportCsv } from "@/features/market/ui";
import { pageHead } from "@/features/market/metadata";

export const Route = createFileRoute("/edges")({
  head: () =>
    pageHead(
      "Edge Finder",
      "Today's unusual stock moves (pre-market gaps and heavy volume), each with its real two-year track record, plus a paper-pick record that tracks whether you beat the close.",
    ),
  component: EdgeFinder,
});

const dayLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const yearLabel = (d: string) =>
  d
    ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";
const pickTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }) + " ET";
const share = (r: Rate) => (r.n ? `${Math.round(pct(r))}%` : "—");

const BOARD_LABEL: Record<Board["when"], string> = {
  pre: "Pre-market now",
  today: "Today, live",
  last: "Last session",
};
const LEAN: Record<Lean, { label: string; className: string; title: string }> = {
  fade: {
    label: "History: fade it",
    className: "bearish",
    title: "In the past, moves like this more often reversed.",
  },
  follow: {
    label: "History: follow it",
    className: "bullish",
    title: "In the past, moves like this more often kept going.",
  },
  none: {
    label: "No clear edge",
    className: "neutral",
    title: "In the past, moves like this were close to a coin flip.",
  },
};

function EdgeFinder() {
  const edges = useEdges();
  const { picks, add, remove } = usePaperPicks();
  return (
    <>
      <Heading
        title="Edge finder"
        description="The stock-market versions of a moved opening line and sharp money, each with its real track record."
      >
        <LiveLabel />
      </Heading>
      <BettingMap />
      <LiveGate result={edges.data} loading={edges.isLoading}>
        {(board) => (
          <>
            <BoardPanel board={board} picks={picks} onPick={add} />
            <RecordPanel board={board} />
          </>
        )}
      </LiveGate>
      <PicksPanel picks={picks} onRemove={remove} />
    </>
  );
}

function BettingMap() {
  const items = [
    {
      bet: "Opening line",
      stock: "The gap",
      text: `Each morning a stock "opens" at a new price. When it opens ${GAP_MIN}%+ away from yesterday's close, the line has moved overnight, usually on news. Some gaps fill (drift back to yesterday's close), others keep going. We track which.`,
    },
    {
      bet: "Sharp money / line movement",
      stock: "Unusual volume",
      text: `Big funds can't hide: when they buy or sell, far more shares trade than normal. ${VOLUME_MIN}× normal volume on a real price move is the closest thing to seeing sharp money hit a side.`,
    },
    {
      bet: "Closing line value",
      stock: "Beat the close",
      text: "In betting, getting a better number than the closing line is the best sign of real skill. Here, each paper pick is graded on whether your entry price beat where the stock closed that day, then on the result after 5 sessions.",
    },
    {
      bet: "Best price across books",
      stock: "A good fill",
      text: "Stocks don't have different books: every broker must give you about the same national best price. Your edge is how you enter: use limit orders, and be careful pre-market, when fewer people trade and prices are jumpier.",
    },
  ];
  return (
    <div className="edge-map">
      {items.map((i) => (
        <div key={i.bet} className="edge-map-card">
          <small>
            {i.bet} <span aria-hidden>→</span> <b>{i.stock}</b>
          </small>
          <p>{i.text}</p>
        </div>
      ))}
    </div>
  );
}

function BoardPanel({
  board,
  picks,
  onPick,
}: {
  board: Board;
  picks: PaperPick[];
  onPick: (p: Omit<PaperPick, "id" | "at">) => void;
}) {
  const [showQuiet, setShowQuiet] = useState(false);
  const flagged = board.rows.filter((r) => r.flagged);
  const rows = showQuiet ? board.rows : flagged;
  const leaning = flagged.filter((r) => r.lean !== "none").length;
  const recent = new Set(
    picks.filter((p) => Date.now() - Date.parse(p.at) < 12 * 3_600_000).map((p) => p.ticker),
  );
  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Board"
          value={`${BOARD_LABEL[board.when]}${board.when === "today" ? "" : ` · ${dayLabel(board.date)}`}`}
        />
        <Stat
          label="Unusual today"
          value={`${flagged.length} of ${board.stocks}`}
          positive={flagged.length > 0}
        />
        <Stat label="With a historical lean" value={String(leaning)} positive={leaning > 0} />
        <Stat label="Biggest mover" value={flagged[0]?.ticker ?? "—"} />
      </div>
      <Panel
        title="Today's board"
        action={
          <Button variant="ghost" size="sm" onClick={() => setShowQuiet(!showQuiet)}>
            {showQuiet ? "Hide quiet stocks" : `Show all ${board.rows.length}`}
          </Button>
        }
      >
        <div className="table-scroll">
          <table className="stock-table edge-table">
            <thead>
              <tr>
                <th>SYMBOL</th>
                <th>SIGNALS</th>
                <th>WHY IT'S HERE</th>
                <th className="text-right">PRICE</th>
                <th>PAPER PICK</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker} className={r.flagged ? "" : "opacity-60"}>
                  <td>
                    <Link to="/research" search={{ ticker: r.ticker }}>
                      <div className="stock-symbol">{r.ticker}</div>
                      <div className="stock-name">{r.name}</div>
                    </Link>
                  </td>
                  <td>
                    <Signals row={r} />
                  </td>
                  <td className="edge-reasons">
                    {r.reasons.length ? (
                      r.reasons.map((t) => <p key={t}>{t}</p>)
                    ) : (
                      <p>Nothing unusual: a normal open and normal volume.</p>
                    )}
                  </td>
                  <td className="text-right">{money(r.price)}</td>
                  <td>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        title={`Paper pick: ${r.ticker} goes up from ${money(r.price)}`}
                        onClick={() =>
                          onPick({
                            ticker: r.ticker,
                            side: "up",
                            entry: r.price,
                            signal: signalName(r),
                          })
                        }
                      >
                        <ArrowUpRight className="positive" />
                        Up
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title={`Paper pick: ${r.ticker} goes down from ${money(r.price)}`}
                        onClick={() =>
                          onPick({
                            ticker: r.ticker,
                            side: "down",
                            entry: r.price,
                            signal: signalName(r),
                          })
                        }
                      >
                        <ArrowDownRight className="negative" />
                        Down
                      </Button>
                    </div>
                    {recent.has(r.ticker) && <div className="ext-line">Picked ✓</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="empty">
              Nothing unusual right now: no stock gapped {GAP_MIN}%+ or traded {VOLUME_MIN}× its
              normal volume. Quiet days are normal. Like betting, the edge is in waiting for the
              right spot.
            </div>
          )}
        </div>
      </Panel>
      <div className="mt-3 text-xs text-muted-foreground">
        {board.when === "pre"
          ? "Pre-market gaps use the latest real-time trade (IEX) versus yesterday's close. Volume shown is yesterday's, since pre-market volume is too thin to judge."
          : board.when === "today"
            ? "Today's volume is compared with a typical day at this time of day (trading is heaviest at the open and close), about 15 minutes behind on the free data plan."
            : "The market is closed, so this is the most recent finished session. The board switches to pre-market gaps at 4:00 AM ET."}{" "}
        Half days are left out of volume signals because they always look quiet.
      </div>
    </>
  );
}

function Signals({ row }: { row: EdgeRow }) {
  const lean = LEAN[row.lean];
  return (
    <div className="flex flex-col items-start gap-1">
      {row.gap && Math.abs(row.gap.pct) >= GAP_MIN && (
        <span className="edge-chip">
          Gap {percent(row.gap.pct)}
          {row.gap.source === "pre-market" ? " pre-mkt" : ""}
        </span>
      )}
      {row.volume && row.volume.rel >= VOLUME_MIN && (
        <span className="edge-chip">{row.volume.rel.toFixed(1)}× volume</span>
      )}
      {row.flagged && (
        <span className={`signal-pill ${lean.className}`} title={lean.title}>
          {lean.label}
        </span>
      )}
    </div>
  );
}

const signalName = (r: EdgeRow) =>
  [
    r.gap && Math.abs(r.gap.pct) >= GAP_MIN ? `Gap ${r.gap.pct > 0 ? "up" : "down"}` : "",
    r.volume && r.volume.rel >= VOLUME_MIN ? "Volume spike" : "",
  ]
    .filter(Boolean)
    .join(" + ") || "No signal";

function RecordPanel({ board }: { board: Board }) {
  const { book } = board;
  const down = (r: Rate): Rate => ({ hits: r.n - r.hits, n: r.n });
  const rows: {
    signal: string;
    n: number;
    measure: string;
    hit: Rate;
    base: string;
    avg: number;
  }[] = [
    {
      signal: `Gap up ${GAP_MIN}%+`,
      n: book.gapUp.n,
      measure: "Filled the same day (fade wins)",
      hit: book.gapUp.filled,
      base: "—",
      avg: -book.gapUp.avgFollow,
    },
    {
      signal: `Gap up ${GAP_MIN}%+`,
      n: book.gapUp.n,
      measure: "Closed above the open (follow wins)",
      hit: book.gapUp.extended,
      base: share(book.baseline.closeAboveOpen),
      avg: book.gapUp.avgFollow,
    },
    {
      signal: `Gap down ${GAP_MIN}%+`,
      n: book.gapDown.n,
      measure: "Filled the same day (fade wins)",
      hit: book.gapDown.filled,
      base: "—",
      avg: -book.gapDown.avgFollow,
    },
    {
      signal: `Gap down ${GAP_MIN}%+`,
      n: book.gapDown.n,
      measure: "Closed below the open (follow wins)",
      hit: book.gapDown.extended,
      base: share(down(book.baseline.closeAboveOpen)),
      avg: book.gapDown.avgFollow,
    },
    {
      signal: `${VOLUME_MIN}× volume, up day`,
      n: book.volumeUp.n,
      measure: `Higher ${HOLD_DAYS} sessions later`,
      hit: book.volumeUp.continued,
      base: share(book.baseline.upAfter),
      avg: book.volumeUp.avgFollow,
    },
    {
      signal: `${VOLUME_MIN}× volume, down day`,
      n: book.volumeDown.n,
      measure: `Lower ${HOLD_DAYS} sessions later`,
      hit: book.volumeDown.continued,
      base: share(down(book.baseline.upAfter)),
      avg: book.volumeDown.avgFollow,
    },
  ];
  return (
    <Panel
      title={`Signal record · ${board.stocks} stocks · ${yearLabel(book.from)} to ${yearLabel(book.to)}`}
      className="mt-6"
    >
      <div className="table-scroll">
        <table className="stock-table">
          <thead>
            <tr>
              <th>SIGNAL</th>
              <th className="text-right">TIMES SEEN</th>
              <th>OUTCOME MEASURED</th>
              <th className="text-right">HIT RATE</th>
              <th className="text-right">ORDINARY DAY</th>
              <th className="text-right">AVG MOVE FOR THAT SIDE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.signal + r.measure}>
                <td>{r.signal}</td>
                <td className="text-right">{r.n}</td>
                <td className="text-muted-foreground">{r.measure}</td>
                <td className="text-right font-mono">{share(r.hit)}</td>
                <td className="text-right font-mono text-muted-foreground">{r.base}</td>
                <td className={`text-right ${r.avg >= 0 ? "positive" : "negative"}`}>
                  {r.n ? percent(r.avg) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel-body text-xs text-muted-foreground leading-6">
        Read it like an against-the-spread record. "Hit rate" is how often that side won in the
        past; "Ordinary day" is how often the same thing happened on any day, so the gap between the
        two is the edge (or lack of one). Real daily prices, split- and dividend-adjusted, before
        trading costs. Past records can change, and a small edge can vanish once costs are counted.
      </div>
    </Panel>
  );
}

function PicksPanel({ picks, onRemove }: { picks: PaperPick[]; onRemove: (id: string) => void }) {
  const results = usePickResults(picks);
  const graded = dataOf(results.data) ?? [];
  const byId = new Map(graded.map((g) => [g.id, g]));
  const record = pickRecord(
    picks.map(
      (p) => byId.get(p.id) ?? { id: p.id, closeDate: null, close: null, clv: null, final: null },
    ),
  );
  return (
    <Panel
      title="My paper picks"
      className="mt-6"
      action={
        picks.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => exportPicks(picks, byId)}>
            <ArrowDownToLine />
            Export
          </Button>
        )
      }
    >
      <div className="panel-body">
        <div className="stat-grid">
          <Stat
            label={`Record after ${HOLD_DAYS} sessions (W-L)`}
            value={`${record.wins}-${record.losses}`}
            positive={record.wins > record.losses}
          />
          <Stat
            label="Beat the close"
            value={record.beatClose.n ? `${record.beatClose.hits} of ${record.beatClose.n}` : "—"}
            positive={pct(record.beatClose) > 50}
          />
          <Stat
            label="Avg vs the close"
            value={record.avgClv === null ? "—" : percent(record.avgClv)}
            positive={(record.avgClv ?? 0) > 0}
          />
          <Stat
            label="Avg result"
            value={record.avgReturn === null ? "—" : percent(record.avgReturn)}
            positive={(record.avgReturn ?? 0) > 0}
          />
        </div>
        {picks.length ? (
          <div className="table-scroll">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>PICKED</th>
                  <th>SYMBOL</th>
                  <th>SIDE</th>
                  <th>SIGNAL</th>
                  <th className="text-right">ENTRY</th>
                  <th className="text-right">CLOSE · VS ENTRY</th>
                  <th className="text-right">{HOLD_DAYS} SESSIONS LATER</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {picks.map((p) => {
                  const g = byId.get(p.id);
                  return (
                    <tr key={p.id}>
                      <td className="text-muted-foreground">{pickTime(p.at)}</td>
                      <td className="stock-symbol">{p.ticker}</td>
                      <td className={p.side === "up" ? "positive" : "negative"}>
                        {p.side === "up" ? "Up" : "Down"}
                      </td>
                      <td className="text-muted-foreground">{p.signal}</td>
                      <td className="text-right">{money(p.entry)}</td>
                      <td className="text-right">
                        {g?.close != null && g.clv != null ? (
                          <>
                            {money(g.close)}{" "}
                            <span className={g.clv > 0 ? "positive" : "negative"}>
                              {g.clv > 0 ? "beat" : "missed"} {percent(g.clv)}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Waiting for the close</span>
                        )}
                      </td>
                      <td className="text-right">
                        {g?.final ? (
                          <span className={g.final.ret > 0 ? "positive" : "negative"}>
                            {g.final.ret > 0 ? "W" : "L"} {percent(g.final.ret)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${p.ticker} pick`}
                          onClick={() => onRemove(p.id)}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <Radar className="mx-auto mb-2 size-5" />
            No paper picks yet. Tap Up or Down on the board to make one; it's graded against real
            closing prices.
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground leading-6">
          "Up" is like buying the stock; "Down" is like short selling it. "Beat the close" means
          your entry was better than that day's closing price, the stock version of closing line
          value. Picks are saved in this browser only, and no real money is involved.
        </p>
      </div>
    </Panel>
  );
}

function exportPicks(picks: PaperPick[], byId: Map<string, PickResult>) {
  exportCsv("tradingmurpphhhh-paper-picks.csv", [
    [
      "Picked (ISO)",
      "Ticker",
      "Side",
      "Signal",
      "Entry",
      "Close date",
      "Close",
      "Vs close %",
      `${HOLD_DAYS}-session date`,
      `${HOLD_DAYS}-session price`,
      "Result %",
    ],
    ...picks.map((p) => {
      const g = byId.get(p.id);
      return [
        p.at,
        p.ticker,
        p.side,
        p.signal,
        p.entry,
        g?.closeDate ?? "",
        g?.close ?? "",
        g?.clv?.toFixed(2) ?? "",
        g?.final?.date ?? "",
        g?.final?.price ?? "",
        g?.final?.ret.toFixed(2) ?? "",
      ];
    }),
  ]);
}
