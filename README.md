# TradingMurpphhhh

A personal stock-market research and paper-trading app, and the stocks sibling of
[GamblingMurpphhhh](https://github.com/RJMurph10/GamblingMurpphhhh). The goal is to
learn how markets work by researching stocks and testing ideas with pretend money
("paper trading") before risking anything real.

> **Prices are live.** Quotes refresh every 15 seconds, including pre-market
> (4–9:30 AM ET) and after-hours (4–8 PM ET) trading. Nothing in the app places real trades.

## Live market data (Alpaca)

Market data comes from [Alpaca](https://alpaca.markets)'s free plan:

- **Live prices**: the latest trade on the IEX exchange, in real time, in every session (pre-market, regular, after-hours).
- **Daily history and volume**: the full US market, up to 15 minutes ago (two years of split- and dividend-adjusted closes).
- **Intraday charts (1D / 1W)**: 5- and 30-minute bars from IEX, extended hours included.
- **News**: Benzinga headlines.
- Index levels (S&P 500, Nasdaq, Dow, Russell 2000, VIX) are licensed and not free, so the app shows the funds that track them: SPY, QQQ, DIA, IWM and VIXY.

**Setup:** create a free Alpaca account (paper trading is enough), generate an API key in the dashboard,
then add two secrets in Lovable under **Cloud → Secrets**: `ALPACA_API_KEY_ID` and `ALPACA_API_SECRET_KEY`.
Until they're set, each page shows these steps instead of data. For local development, put the same two
values in your shell environment before `bun run dev`.

The data code lives in `src/features/market/`: `alpaca.server.ts` (API calls, server only),
`market.functions.ts` (what pages request), `live.ts` (refresh timers), `quotes.ts` and `session.ts`
(turning trades into prices and knowing which session the market is in).

## What each page does

| Page | What it's for, in plain English |
| --- | --- |
| **Market overview** | The big picture: how the major indexes (S&P 500, Nasdaq, Dow, Russell 2000) and the VIX "fear gauge" are moving, which sectors are up or down, and how many stocks are rising versus falling ("breadth"). |
| **Stock research** | Look up one company: its price chart and common indicators like moving averages (the average price over the last N days), RSI (is it overbought or oversold?) and MACD (is momentum speeding up or slowing down?). |
| **Prediction engine** | Several simple models each give an up/down opinion on a stock; you choose how much to trust each one and see the combined signal. Illustrative only, not a real forecast. |
| **Strategy backtesting** | "What would have happened if I'd followed this rule in the past?" Runs a strategy over historical (sample) prices, including trading costs, and compares it to just buying and holding the index. |
| **Trading signals** | A filterable list of stocks the models currently flag as bullish or bearish, with the reason for each. |
| **Portfolio analytics** | Enter pretend positions (shares and the price you paid) to track value, profit/loss and risk. |
| **Watchlist** | Stocks you want to keep an eye on. Saved to your account when you sign in. |

## Tech stack

Built with [Lovable](https://lovable.dev) on TanStack Start (React + Vite), Tailwind,
and Lovable Cloud (Supabase) for sign-in and saving watchlists/portfolios.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1559c077-5ae7-4d53-b0f1-1c475541c3aa).
Every change made in Lovable is committed to this repository, and changes pushed to
`main` sync back into Lovable.

## Development

You need [Bun](https://bun.sh) (or Node.js and npm).

```sh
git clone https://github.com/RJMurph10/TradingMurpphhhh
cd TradingMurpphhhh
bun install
bun run dev      # start the app locally
bun run build    # production build
bun run test     # run the tests
```
