// Edge Finder: the stock-market versions of the edges that work in sports betting.
//
//   Opening line  → the gap: how far a stock opens (or trades pre-market) away from yesterday's close.
//   Sharp money   → unusual volume: far more shares changing hands than normal, a sign big players are active.
//   Closing line value → "beat the close": whether your paper pick's entry price was better than where
//                  the stock finished that day.
//
// Everything here is plain math on real daily bars, with no network, so it runs the same on the server and in tests.

import type { DailyBar, Quote } from "./quotes";
import { mean } from "./quant";
import { closeInstant, closeMinutes, type Session } from "./session";

/** A gap this big (percent from the prior close) counts as a moved opening line. */
export const GAP_MIN = 1.5;
/** Volume this many times its 20-session average counts as unusual. */
export const VOLUME_MIN = 1.5;
/** A volume spike needs a real price move too, so we know which way the money went. */
export const VOLUME_MOVE_MIN = 0.5;
/** How many sessions after a signal we look to grade it. */
export const HOLD_DAYS = 5;
const LOOKBACK = 20;

/** What happened on one finished trading day, and right after it. */
export type DayFacts = {
  date: string;
  prevClose: number;
  /** Open versus the prior close, in percent. */
  gap: number;
  /** Shares traded versus the 20 sessions before, e.g. 2.1 = 2.1 times normal. */
  relVolume: number;
  /** Close versus the prior close, in percent. */
  dayMove: number;
  /** Close versus the open, in percent. */
  openToClose: number;
  /** For a gap: did the price trade back to the prior close during the day? */
  filled: boolean;
  /** Close-to-close return over the next HOLD_DAYS sessions, in percent (null near the end of the data). */
  next: number | null;
  halfDay: boolean;
};

/** Facts for every day that has 20 sessions of history before it. `bars` must be finished sessions, oldest first. */
export function dayFacts(bars: DailyBar[]): DayFacts[] {
  const out: DayFacts[] = [];
  for (let i = LOOKBACK; i < bars.length; i++) {
    const b = bars[i]!;
    const prev = bars[i - 1]!;
    const avgVol = mean(bars.slice(i - LOOKBACK, i).map((x) => x.v));
    const gap = (b.o / prev.c - 1) * 100;
    const later = bars[i + HOLD_DAYS];
    out.push({
      date: b.date,
      prevClose: prev.c,
      gap,
      relVolume: avgVol ? b.v / avgVol : 0,
      dayMove: (b.c / prev.c - 1) * 100,
      openToClose: (b.c / b.o - 1) * 100,
      filled: gap >= 0 ? b.l <= prev.c : b.h >= prev.c,
      next: later ? (later.c / b.c - 1) * 100 : null,
      halfDay: closeMinutes(b.date) < 16 * 60,
    });
  }
  return out;
}

export type Rate = { hits: number; n: number };
const rate = (list: boolean[]): Rate => ({ hits: list.filter(Boolean).length, n: list.length });
export const pct = (r: Rate) => (r.n ? (r.hits / r.n) * 100 : 0);

export type GapRecord = {
  n: number;
  /** Traded back to the prior close the same day ("the gap filled"). */
  filled: Rate;
  /** Finished the day further in the gap's direction than it opened ("the gap extended"). */
  extended: Rate;
  /** Average open-to-close move, signed so positive means "kept going the gap's way". */
  avgFollow: number;
};

export type VolumeRecord = {
  n: number;
  /** Kept moving the same way over the next HOLD_DAYS sessions. */
  continued: Rate;
  /** Average move over the next HOLD_DAYS sessions, signed so positive means "kept going". */
  avgFollow: number;
};

/** Each signal's historical record, plus what an ordinary day looks like for comparison. */
export type SignalBook = {
  gapUp: GapRecord;
  gapDown: GapRecord;
  volumeUp: VolumeRecord;
  volumeDown: VolumeRecord;
  baseline: {
    /** Any day: closed above its open. */
    closeAboveOpen: Rate;
    /** Any day: higher HOLD_DAYS sessions later. */
    upAfter: Rate;
  };
  from: string;
  to: string;
};

const isGap = (f: DayFacts, dir: 1 | -1) => f.gap * dir >= GAP_MIN;
const isVolume = (f: DayFacts, dir: 1 | -1) =>
  !f.halfDay && f.relVolume >= VOLUME_MIN && f.dayMove * dir >= VOLUME_MOVE_MIN;

function gapRecord(days: DayFacts[], dir: 1 | -1): GapRecord {
  const hits = days.filter((f) => isGap(f, dir));
  return {
    n: hits.length,
    filled: rate(hits.map((f) => f.filled)),
    extended: rate(hits.map((f) => f.openToClose * dir > 0)),
    avgFollow: mean(hits.map((f) => f.openToClose * dir)),
  };
}

function volumeRecord(days: DayFacts[], dir: 1 | -1): VolumeRecord {
  const hits = days.filter((f) => isVolume(f, dir) && f.next !== null);
  return {
    n: hits.length,
    continued: rate(hits.map((f) => f.next! * dir > 0)),
    avgFollow: mean(hits.map((f) => f.next! * dir)),
  };
}

/** The record of every signal across all the given stocks' histories. */
export function signalBook(histories: DayFacts[][]): SignalBook {
  const days = histories.flat();
  const dates = days.map((d) => d.date).sort();
  return {
    gapUp: gapRecord(days, 1),
    gapDown: gapRecord(days, -1),
    volumeUp: volumeRecord(days, 1),
    volumeDown: volumeRecord(days, -1),
    baseline: {
      closeAboveOpen: rate(days.map((f) => f.openToClose > 0)),
      upAfter: rate(days.filter((f) => f.next !== null).map((f) => f.next! > 0)),
    },
    from: dates[0] ?? "",
    to: dates.at(-1) ?? "",
  };
}

/* ---------- today's board ---------- */

/**
 * Rough share of a regular session's volume that has traded after a given number of minutes.
 * US stocks trade heavily at the open and the close, so a straight-line estimate would mislead.
 */
const VOLUME_CURVE: [number, number][] = [
  [0, 0],
  [30, 0.13],
  [60, 0.21],
  [120, 0.33],
  [180, 0.43],
  [240, 0.52],
  [300, 0.62],
  [360, 0.78],
  [390, 1],
];
export function expectedVolumeShare(minutesSinceOpen: number) {
  const m = Math.max(0, Math.min(390, minutesSinceOpen));
  for (let i = 1; i < VOLUME_CURVE.length; i++) {
    const [m1, s1] = VOLUME_CURVE[i]!;
    const [m0, s0] = VOLUME_CURVE[i - 1]!;
    if (m <= m1) return s0 + ((m - m0) / (m1 - m0)) * (s1 - s0);
  }
  return 1;
}

export type Lean = "fade" | "follow" | "none";

export type EdgeRow = {
  ticker: string;
  name: string;
  sector: string;
  /** The price a paper pick made now would be entered at. */
  price: number;
  gap: { pct: number; source: "pre-market" | "open"; filled: boolean | null } | null;
  volume: { rel: number; dayMove: number; pace: boolean } | null;
  /** 1 = right at a threshold; higher = more unusual. Rows below 1 are quiet. */
  strength: number;
  flagged: boolean;
  /** What history suggests: fade the move or follow it. */
  lean: Lean;
  reasons: string[];
};

export type Board = {
  /** "pre": pre-market now; "today": the market is open; "last": the most recent finished session. */
  when: "pre" | "today" | "last";
  date: string;
  rows: EdgeRow[];
  book: SignalBook;
  stocks: number;
};

const fmtPct = (n: number, digits = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;
const share = (r: Rate) => `${Math.round(pct(r))}%`;
const dayName = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

/** "fade" when history says the move usually reverses, "follow" when it usually keeps going, else "none". */
export function leanOf(row: Pick<EdgeRow, "gap" | "volume">, book: SignalBook): Lean {
  const MIN_N = 30;
  const MARGIN = 5;
  if (row.gap && Math.abs(row.gap.pct) >= GAP_MIN) {
    const rec = row.gap.pct > 0 ? book.gapUp : book.gapDown;
    if (rec.n >= MIN_N) {
      if (pct(rec.filled) >= 50 + MARGIN && rec.avgFollow < 0) return "fade";
      if (pct(rec.extended) >= 50 + MARGIN && rec.avgFollow > 0) return "follow";
    }
  }
  if (
    row.volume &&
    row.volume.rel >= VOLUME_MIN &&
    Math.abs(row.volume.dayMove) >= VOLUME_MOVE_MIN
  ) {
    const up = row.volume.dayMove > 0;
    const rec = up ? book.volumeUp : book.volumeDown;
    // Compare with an ordinary day: "up" days are already more common than "down" days.
    const base = up ? pct(book.baseline.upAfter) : 100 - pct(book.baseline.upAfter);
    if (rec.n >= MIN_N) {
      if (pct(rec.continued) >= base + MARGIN) return "follow";
      if (pct(rec.continued) <= base - MARGIN) return "fade";
    }
  }
  return "none";
}

/** Plain-English reasons for one stock's row, using the whole group's record and the stock's own. */
export function explain(
  row: Omit<EdgeRow, "reasons" | "lean" | "flagged">,
  book: SignalBook,
  own: SignalBook,
  ctx: { when: Board["when"]; refDate: string; stocks: number },
): string[] {
  const { refDate, stocks } = ctx;
  const out: string[] = [];
  const since = `over the last ${Math.max(1, Math.round((Date.parse(book.to) - Date.parse(book.from)) / (365 * 86_400_000)))} years`;
  const prior = `${dayName(refDate)}'s close`;
  if (row.gap && Math.abs(row.gap.pct) >= GAP_MIN) {
    const up = row.gap.pct > 0;
    const where =
      row.gap.source === "pre-market"
        ? `is trading ${fmtPct(row.gap.pct)} versus ${prior} in pre-market`
        : `opened ${fmtPct(row.gap.pct)} versus the prior close${ctx.when === "today" ? " today" : ` on ${dayName(refDate)}`}`;
    const fill =
      row.gap.filled === null
        ? ""
        : row.gap.filled
          ? " It has already traded back to the prior close (the gap filled)."
          : "";
    out.push(`Opening line moved: ${row.ticker} ${where}.${fill}`);
    const rec = up ? book.gapUp : book.gapDown;
    const mine = up ? own.gapUp : own.gapDown;
    out.push(
      `Record: across these ${stocks} stocks ${since}, gaps ${up ? "up" : "down"} of ${GAP_MIN}%+ filled the same day ${share(rec.filled)} of the time and kept going ${share(rec.extended)} (${rec.n} times).` +
        (mine.n ? ` ${row.ticker}'s own: filled ${mine.filled.hits} of ${mine.n}.` : ""),
    );
  }
  if (row.volume && row.volume.rel >= VOLUME_MIN) {
    const moved = Math.abs(row.volume.dayMove) >= VOLUME_MOVE_MIN;
    const up = row.volume.dayMove > 0;
    const verb = row.volume.pace ? "is on pace for" : "traded";
    const when = ctx.when === "today" ? "today" : `on ${dayName(refDate)}`;
    out.push(
      `Sharp-money tell: ${row.ticker} ${verb} ${row.volume.rel.toFixed(1)}× its normal volume ${when}, ${moved ? `${up ? "up" : "down"} ${fmtPct(Math.abs(row.volume.dayMove)).slice(1)} on the day` : "with little price change, so the direction is unclear"}.`,
    );
    if (moved) {
      const rec = up ? book.volumeUp : book.volumeDown;
      const base = up ? pct(book.baseline.upAfter) : 100 - pct(book.baseline.upAfter);
      const mine = up ? own.volumeUp : own.volumeDown;
      out.push(
        `Record: after spikes like this, stocks kept moving ${up ? "up" : "down"} over the next ${HOLD_DAYS} sessions ${share(rec.continued)} of the time (${rec.n} times), versus ${Math.round(base)}% for an ordinary day.` +
          (mine.n ? ` ${row.ticker}'s own: ${mine.continued.hits} of ${mine.n}.` : ""),
      );
    }
  }
  return out;
}

/**
 * One stock's line on today's board.
 * `done` are finished sessions (oldest first); `todayBar` is today's bar while the market is open (about 15 minutes behind).
 */
export function boardRow(
  quote: Quote,
  done: DailyBar[],
  todayBar: DailyBar | null,
  session: Session,
  now: Date,
): Omit<EdgeRow, "reasons" | "lean" | "flagged" | "strength"> | null {
  const last = done.at(-1);
  if (!last || done.length < LOOKBACK + 1) return null;
  const base = {
    ticker: quote.ticker,
    name: quote.name,
    sector: quote.sector,
    price: quote.ext?.price ?? quote.price,
  };
  const avgOf = (bars: DailyBar[]) => mean(bars.slice(-LOOKBACK).map((b) => b.v));

  if (session === "pre") {
    const lastFacts = dayFacts(done.slice(-(LOOKBACK + 1)))[0];
    const pre = quote.ext?.label === "Pre-market" ? quote.ext : null;
    return {
      ...base,
      gap: pre ? { pct: pre.change, source: "pre-market", filled: null } : null,
      volume:
        lastFacts && !lastFacts.halfDay
          ? { rel: lastFacts.relVolume, dayMove: lastFacts.dayMove, pace: false }
          : null,
    };
  }
  if (session === "regular" && todayBar) {
    const gap = (todayBar.o / last.c - 1) * 100;
    // The day's volume is about 15 minutes behind on the free data plan.
    const minutes =
      (now.getTime() -
        (closeInstant(todayBar.date) - closeMinutes(todayBar.date) * 60_000 + 570 * 60_000)) /
        60_000 -
      15;
    const share = expectedVolumeShare(minutes);
    const avg = avgOf(done);
    const half = closeMinutes(todayBar.date) < 16 * 60;
    return {
      ...base,
      gap: {
        pct: gap,
        source: "open",
        filled: gap >= 0 ? todayBar.l <= last.c : todayBar.h >= last.c,
      },
      volume:
        !half && share >= 0.1 && avg
          ? {
              rel: todayBar.v / (avg * share),
              dayMove: (quote.price / last.c - 1) * 100,
              pace: true,
            }
          : null,
    };
  }
  const facts = dayFacts(done.slice(-(LOOKBACK + 1)))[0];
  if (!facts) return null;
  return {
    ...base,
    gap: { pct: facts.gap, source: "open", filled: facts.filled },
    volume: facts.halfDay ? null : { rel: facts.relVolume, dayMove: facts.dayMove, pace: false },
  };
}

export function strengthOf(row: Pick<EdgeRow, "gap" | "volume">) {
  const g = row.gap ? Math.abs(row.gap.pct) / GAP_MIN : 0;
  const v =
    row.volume && Math.abs(row.volume.dayMove) >= VOLUME_MOVE_MIN ? row.volume.rel / VOLUME_MIN : 0;
  return Math.max(g, v);
}

/* ---------- paper picks and "beat the close" ---------- */

export type PaperPick = {
  id: string;
  ticker: string;
  /** "up" = you think it rises (like buying); "down" = you think it falls (like short selling). */
  side: "up" | "down";
  entry: number;
  /** When the pick was made, ISO time. */
  at: string;
  /** Which signal it followed, for the record. */
  signal: string;
};

export type PickResult = {
  id: string;
  /** The session whose close grades the entry: the pick day, or the next session if made after the close. */
  closeDate: string | null;
  close: number | null;
  /** Percent better (positive) or worse than the close, from the pick's side. Like closing line value. */
  clv: number | null;
  /** HOLD_DAYS sessions later. */
  final: { date: string; price: number; ret: number } | null;
};

/** Grades a pick against finished sessions (oldest first). */
export function gradePick(pick: PaperPick, done: DailyBar[]): PickResult {
  const sign = pick.side === "up" ? 1 : -1;
  const at = Date.parse(pick.at);
  const i = done.findIndex((b) => closeInstant(b.date) > at);
  const ref = i >= 0 ? done[i]! : null;
  const later = i >= 0 ? done[i + HOLD_DAYS] : undefined;
  return {
    id: pick.id,
    closeDate: ref?.date ?? null,
    close: ref?.c ?? null,
    clv: ref ? sign * (ref.c / pick.entry - 1) * 100 : null,
    final: later
      ? { date: later.date, price: later.c, ret: sign * (later.c / pick.entry - 1) * 100 }
      : null,
  };
}

/** The pick record, like a betting record: wins and losses, and how often the entry beat the close. */
export function pickRecord(results: PickResult[]) {
  const graded = results.filter((r) => r.final);
  const clvs = results.flatMap((r) => (r.clv === null ? [] : [r.clv]));
  return {
    wins: graded.filter((r) => r.final!.ret > 0).length,
    losses: graded.filter((r) => r.final!.ret <= 0).length,
    pending: results.length - graded.length,
    avgReturn: graded.length ? mean(graded.map((r) => r.final!.ret)) : null,
    beatClose: rate(clvs.map((c) => c > 0)),
    avgClv: clvs.length ? mean(clvs) : null,
  };
}
