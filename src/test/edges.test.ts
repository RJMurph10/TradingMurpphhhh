import { describe, expect, it } from "vitest";
import {
  boardRow,
  dayFacts,
  expectedVolumeShare,
  gradePick,
  leanOf,
  pickRecord,
  signalBook,
  strengthOf,
  type PaperPick,
} from "@/features/market/edges";
import type { DailyBar, Quote } from "@/features/market/quotes";

/** Trading days starting Mon 2026-06-01 (skips weekends and the Jun 19 holiday). */
function sessions(n: number) {
  const out: string[] = [];
  const d = new Date("2026-06-01T12:00:00Z");
  while (out.length < n) {
    const s = d.toISOString().slice(0, 10);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6 && s !== "2026-06-19" && s !== "2026-07-03") out.push(s);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
const flat = (dates: string[], price = 100, v = 1_000_000): DailyBar[] =>
  dates.map((date) => ({ date, o: price, h: price + 0.5, l: price - 0.5, c: price, v }));

describe("dayFacts", () => {
  it("measures gap, relative volume, fill and the move 5 sessions later", () => {
    const dates = sessions(30);
    const bars = flat(dates);
    // Day 21 gaps up 3% on triple volume and never comes back to 100; 5 sessions later it closes at 106.
    bars[21] = { date: dates[21]!, o: 103, h: 105, l: 102, c: 104, v: 3_000_000 };
    for (let i = 22; i < 30; i++)
      bars[i] = { ...bars[i]!, o: 104, h: 104, l: 104, c: i === 26 ? 106 : 104 };
    const f = dayFacts(bars).find((x) => x.date === dates[21])!;
    expect(f.gap).toBeCloseTo(3);
    expect(f.relVolume).toBeCloseTo(3);
    expect(f.filled).toBe(false);
    expect(f.dayMove).toBeCloseTo(4);
    expect(f.next).toBeCloseTo((106 / 104 - 1) * 100);
  });

  it("counts a gap down as filled when the high reaches the prior close", () => {
    const dates = sessions(22);
    const bars = flat(dates);
    bars[21] = { date: dates[21]!, o: 97, h: 100.2, l: 96, c: 99, v: 1_000_000 };
    expect(dayFacts(bars).at(-1)!.filled).toBe(true);
  });
});

describe("signalBook", () => {
  it("records gaps and volume spikes and compares with ordinary days", () => {
    const dates = sessions(40);
    const bars = flat(dates);
    bars[25] = { date: dates[25]!, o: 103, h: 103, l: 99.5, c: 100, v: 2_000_000 }; // gap up that filled
    bars[30] = { date: dates[30]!, o: 100, h: 102, l: 100, c: 102, v: 3_000_000 }; // volume spike up day
    for (let i = 31; i < 40; i++) bars[i] = { ...bars[i]!, o: 102, h: 103, l: 101, c: 103 };
    const book = signalBook([dayFacts(bars)]);
    expect(book.gapUp.n).toBe(1);
    expect(book.gapUp.filled).toEqual({ hits: 1, n: 1 });
    expect(book.gapUp.extended).toEqual({ hits: 0, n: 1 });
    expect(book.volumeUp.n).toBe(1);
    expect(book.volumeUp.continued).toEqual({ hits: 1, n: 1 });
    expect(book.gapDown.n).toBe(0);
  });
});

describe("leanOf", () => {
  const book = (filled: number, extended: number, avgFollow: number) => ({
    ...signalBook([]),
    gapUp: {
      n: 100,
      filled: { hits: filled, n: 100 },
      extended: { hits: extended, n: 100 },
      avgFollow,
    },
  });
  const row = { gap: { pct: 2, source: "open" as const, filled: null }, volume: null };
  it("says fade when gaps usually filled and lost money for followers", () => {
    expect(leanOf(row, book(62, 40, -0.4))).toBe("fade");
  });
  it("says follow when gaps usually kept going", () => {
    expect(leanOf(row, book(30, 60, 0.5))).toBe("follow");
  });
  it("says no clear edge near a coin flip", () => {
    expect(leanOf(row, book(52, 49, 0.1))).toBe("none");
  });
});

describe("boardRow", () => {
  const quote = (ext: Quote["ext"] = null): Quote => ({
    ticker: "AAPL",
    name: "Apple",
    sector: "Tech",
    price: 100,
    change: 0,
    prevClose: 100,
    volume: 0,
    dayHigh: null,
    dayLow: null,
    ext,
    lastTradeAt: null,
  });
  const dates = sessions(25);
  const done = flat(dates);

  it("uses the pre-market price as the opening line before the bell", () => {
    const row = boardRow(
      quote({ label: "Pre-market", price: 103, change: 3 }),
      done,
      null,
      "pre",
      new Date(),
    )!;
    expect(row.gap).toEqual({ pct: 3, source: "pre-market", filled: null });
    expect(row.price).toBe(103);
    expect(strengthOf(row)).toBeCloseTo(2);
  });

  it("paces today's volume by time of day during the session", () => {
    const today = "2026-07-08"; // a normal full day after the sample sessions
    const now = new Date("2026-07-08T15:45:00Z"); // 11:45 AM ET, 2h15 in; data ~15 min behind → 2h
    const todayBar = { date: today, o: 98, h: 99, l: 97, c: 98.5, v: 660_000 };
    const row = boardRow({ ...quote(), price: 98.5 }, done, todayBar, "regular", now)!;
    expect(row.gap!.pct).toBeCloseTo(-2);
    expect(row.gap!.filled).toBe(false);
    // 2 hours in ≈ 33% of a day's volume; 660K vs 330K expected = 2×.
    expect(row.volume!.rel).toBeCloseTo(2, 1);
    expect(row.volume!.pace).toBe(true);
  });
});

describe("expectedVolumeShare", () => {
  it("is front-loaded and reaches 100% at the close", () => {
    expect(expectedVolumeShare(0)).toBe(0);
    expect(expectedVolumeShare(195)).toBeGreaterThan(0.4);
    expect(expectedVolumeShare(195)).toBeLessThan(0.5);
    expect(expectedVolumeShare(390)).toBe(1);
  });
});

describe("gradePick", () => {
  const dates = sessions(12);
  const bars = dates.map((date, i) => ({
    date,
    o: 100 + i,
    h: 101 + i,
    l: 99 + i,
    c: 100 + i,
    v: 1,
  }));
  const pick = (over: Partial<PaperPick>): PaperPick => ({
    id: "1",
    ticker: "AAPL",
    side: "up",
    entry: 100,
    at: `${dates[2]}T14:00:00Z`,
    signal: "Gap up",
    ...over,
  });

  it("grades an up pick made during the day against that day's close", () => {
    const r = gradePick(pick({}), bars);
    expect(r.closeDate).toBe(dates[2]);
    expect(r.clv).toBeCloseTo(2); // bought at 100, closed at 102
    expect(r.final!.date).toBe(dates[7]);
    expect(r.final!.ret).toBeCloseTo(7);
  });

  it("uses the next session's close for a pick made after hours, and flips the sign for down picks", () => {
    const r = gradePick(pick({ side: "down", at: `${dates[2]}T22:00:00Z` }), bars);
    expect(r.closeDate).toBe(dates[3]);
    expect(r.clv).toBeCloseTo(-3);
  });

  it("stays pending when the session hasn't closed yet", () => {
    const r = gradePick(pick({ at: `${dates[11]}T22:00:00Z` }), bars);
    expect(r).toMatchObject({ closeDate: null, clv: null, final: null });
  });

  it("adds up a record", () => {
    const rec = pickRecord([
      gradePick(pick({}), bars),
      gradePick(pick({ id: "2", side: "down" }), bars),
    ]);
    expect(rec).toMatchObject({ wins: 1, losses: 1, pending: 0, beatClose: { hits: 1, n: 2 } });
  });
});
