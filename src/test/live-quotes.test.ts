import { describe, expect, it } from "vitest";
import { closeInstant, marketSession } from "@/features/market/session";
import { summarize, type DailyBar } from "@/features/market/quotes";

const bar = (date: string, c: number, v = 1000): DailyBar => ({ date, o: c, h: c + 1, l: c - 1, c, v });

describe("market session (New York time)", () => {
  it.each([
    ["2026-11-30T08:30:00Z", "closed"], // Mon 3:30 AM ET, overnight
    ["2026-11-30T14:00:00Z", "pre"], // Mon 9:00 AM ET
    ["2026-11-30T15:00:00Z", "regular"], // Mon 10:00 AM ET
    ["2026-11-30T21:30:00Z", "post"], // Mon 4:30 PM ET
    ["2026-12-01T01:30:00Z", "closed"], // Mon 8:30 PM ET
    ["2026-11-28T15:00:00Z", "closed"], // Saturday
    ["2026-11-26T15:00:00Z", "closed"], // Thanksgiving
    ["2026-11-27T18:30:00Z", "post"], // Day after Thanksgiving, closes at 1 PM ET
    ["2026-07-01T14:00:00Z", "regular"], // Summer (UTC-4): 10:00 AM ET
  ])("%s is %s", (iso, expected) => {
    expect(marketSession(new Date(iso))).toBe(expected);
  });

  it("knows when the regular session closed, in winter and summer", () => {
    expect(new Date(closeInstant("2026-11-30")).toISOString()).toBe("2026-11-30T21:00:00.000Z");
    expect(new Date(closeInstant("2026-07-01")).toISOString()).toBe("2026-07-01T20:00:00.000Z");
    expect(new Date(closeInstant("2026-11-27")).toISOString()).toBe("2026-11-27T18:00:00.000Z");
  });
});

describe("turning exchange data into a quote", () => {
  const bars = [bar("2026-11-24", 100), bar("2026-11-25", 110), bar("2026-11-27", 121, 500)];

  it("during regular hours, compares the live price with yesterday's close", () => {
    const now = new Date("2026-11-30T15:00:00Z");
    const today = [...bars, bar("2026-11-30", 125, 300)];
    const q = summarize("NVDA", today, { p: 133.1, t: "2026-11-30T14:59:58Z" }, "regular", now)!;
    expect(q.price).toBe(133.1);
    expect(q.prevClose).toBe(121);
    expect(q.change).toBeCloseTo(10, 6);
    expect(q.volume).toBe(300);
    expect(q.ext).toBeNull();
    expect(q.name).toBe("NVIDIA Corporation");
  });

  it("after the close, shows the day's move and the after-hours price separately", () => {
    const now = new Date("2026-11-30T22:00:00Z"); // 5 PM ET
    const today = [...bars, bar("2026-11-30", 133.1)];
    const q = summarize("NVDA", today, { p: 135.762, t: "2026-11-30T21:55:00Z" }, "post", now)!;
    expect(q.price).toBe(133.1);
    expect(q.change).toBeCloseTo(10, 6);
    expect(q.ext?.label).toBe("After hours");
    expect(q.ext?.change).toBeCloseTo(2, 6);
  });

  it("before the open, keeps the last session's move and shows pre-market trading", () => {
    const now = new Date("2026-11-30T13:00:00Z"); // Mon 8 AM ET
    const q = summarize("NVDA", bars, { p: 127.05, t: "2026-11-30T12:59:00Z" }, "pre", now)!;
    expect(q.price).toBe(121); // Friday's close
    expect(q.change).toBeCloseTo(10, 6); // Friday versus Wednesday
    expect(q.ext?.label).toBe("Pre-market");
    expect(q.ext?.change).toBeCloseTo(5, 6);
  });

  it("ignores a partial bar for today before the open", () => {
    const now = new Date("2026-11-30T13:00:00Z");
    const q = summarize("NVDA", [...bars, bar("2026-11-30", 127)], null, "pre", now)!;
    expect(q.price).toBe(121);
    expect(q.ext).toBeNull();
  });

  it("on a weekend, a trade inside Friday's regular hours is not extended-hours", () => {
    const now = new Date("2026-11-28T15:00:00Z");
    const q = summarize("NVDA", bars, { p: 121, t: "2026-11-27T17:59:00Z" }, "closed", now)!;
    expect(q.ext).toBeNull();
  });
});
