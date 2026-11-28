export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
export const number = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export const percent = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
export const signal = (score: number) => (score >= 65 ? "Bullish" : score <= 45 ? "Bearish" : "Neutral");

/** 1234567 → "1.23M" (share counts). */
export function shares(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

/** A time in New York, the market's clock: "4:05 PM ET". */
export function etTime(iso: string) {
  return (
    new Date(iso).toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    }) + " ET"
  );
}
