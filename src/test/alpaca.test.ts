import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Responses below follow the shapes in Alpaca's market data docs.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Alpaca market data client", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env["ALPACA_API_KEY_ID"] = "test-id";
    process.env["ALPACA_API_SECRET_KEY"] = "test-secret";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env["ALPACA_API_KEY_ID"];
    delete process.env["ALPACA_API_SECRET_KEY"];
  });

  it("explains how to connect when the keys are missing", async () => {
    delete process.env["ALPACA_API_KEY_ID"];
    const { latestTrades } = await import("@/features/market/alpaca.server");
    await expect(latestTrades(["AAPL"])).rejects.toMatchObject({ reason: "missing-keys" });
  });

  it("sends the keys as headers and reads the latest trades from IEX", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      json({ trades: { AAPL: { t: "2026-11-30T21:30:00Z", x: "V", p: 238.12, s: 10, c: ["@"], i: 1, z: "C" } } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { latestTrades } = await import("@/features/market/alpaca.server");
    expect(await latestTrades(["AAPL"])).toEqual({ AAPL: { p: 238.12, t: "2026-11-30T21:30:00Z" } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/v2/stocks/trades/latest?symbols=AAPL&feed=iex");
    expect((init?.headers as Record<string, string>)["APCA-API-KEY-ID"]).toBe("test-id");
  });

  it("follows page tokens for daily bars and converts timestamps to New York dates", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("page_token=p2")
        ? json({ bars: { SPY: [{ t: "2026-11-27T05:00:00Z", o: 2, h: 2, l: 2, c: 2, v: 20, n: 1, vw: 2 }] }, next_page_token: null })
        : json({ bars: { SPY: [{ t: "2026-11-25T05:00:00Z", o: 1, h: 1, l: 1, c: 1, v: 10, n: 1, vw: 1 }] }, next_page_token: "p2" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { dailyBars } = await import("@/features/market/alpaca.server");
    const bars = await dailyBars(["SPY"], 30);
    expect(bars["SPY"]!.map((b) => [b.date, b.c])).toEqual([
      ["2026-11-25", 1],
      ["2026-11-27", 2],
    ]);
    expect(fetchMock.mock.calls[0]![0]).toContain("feed=sip");
  });

  it("falls back to the IEX feed when the plan can't read recent full-market data", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("feed=sip")
        ? json({ message: "subscription does not permit querying recent SIP data" }, 403)
        : json({ bars: { SPY: [{ t: "2026-11-25T05:00:00Z", o: 1, h: 1, l: 1, c: 1, v: 10 }] }, next_page_token: null }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { dailyBars } = await import("@/features/market/alpaca.server");
    expect((await dailyBars(["SPY"], 30))["SPY"]).toHaveLength(1);
    expect(fetchMock.mock.calls.at(-1)![0]).toContain("feed=iex");
  });

  it("reports rejected keys clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "unauthorized." }, 401)));
    const { latestTrades } = await import("@/features/market/alpaca.server");
    await expect(latestTrades(["AAPL"])).rejects.toMatchObject({ reason: "auth" });
  });
});
