// React hooks that keep live data fresh, like the gambling site's live scores: each one re-asks the server on a timer.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHistory, getIntraday, getNews, getQuotes, type Live } from "./market.functions";
import { MARKET_SYMBOLS } from "./universe";

/** How often prices refresh in the browser. */
export const QUOTE_REFRESH_MS = 15_000;

const keyOf = (symbols: string[]) => [...new Set(symbols)].sort().join(",");

export function useQuotes(symbols: string[]) {
  const fn = useServerFn(getQuotes);
  const key = keyOf(symbols);
  return useQuery({
    queryKey: ["quotes", key],
    queryFn: () => fn({ data: { symbols: key ? key.split(",") : [] } }),
    refetchInterval: QUOTE_REFRESH_MS,
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  });
}

/** Every ticker the dashboard, ticker tape and signals use. */
export const useMarket = () => useQuotes(MARKET_SYMBOLS);

export function useHistory(symbols: string[]) {
  const fn = useServerFn(getHistory);
  const key = keyOf(symbols);
  return useQuery({
    queryKey: ["history", key],
    queryFn: () => fn({ data: { symbols: key ? key.split(",") : [] } }),
    refetchInterval: 60_000,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useIntraday(symbol: string, range: "1D" | "1W", enabled = true) {
  const fn = useServerFn(getIntraday);
  return useQuery({
    queryKey: ["intraday", symbol, range],
    queryFn: () => fn({ data: { symbol, range } }),
    refetchInterval: 30_000,
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useNews(symbols?: string[]) {
  const fn = useServerFn(getNews);
  return useQuery({
    queryKey: ["news", symbols?.join(",") ?? ""],
    queryFn: () => fn({ data: { symbols } }),
    refetchInterval: 120_000,
  });
}

/** The data of a successful response, or undefined. */
export const dataOf = <T>(r: Live<T> | undefined) => (r?.ok ? r.data : undefined);
