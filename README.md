# TradingMurpphhhh

A personal stock-market research and paper-trading app, and the stocks sibling of
[GamblingMurpphhhh](https://github.com/RJMurph10/GamblingMurpphhhh). The goal is to
learn how markets work by researching stocks and testing ideas with pretend money
("paper trading") before risking anything real.

> **Everything on screen is sample data.** No live market feed is connected yet and
> nothing in the app places real trades. See `roadmap.md` for what's next.

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
