// Paper picks from the Edge Finder, saved in this browser (no account needed).
import { useCallback, useEffect, useState } from "react";
import type { PaperPick } from "./edges";

const KEY = "tradingmurpphhhh:paper-picks";

function load(): PaperPick[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((p) => p && typeof p.ticker === "string" && typeof p.entry === "number")
      : [];
  } catch {
    return [];
  }
}

function save(picks: PaperPick[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(picks));
  } catch {
    // Private windows can block storage; the picks still work until the page is closed.
  }
}

export function usePaperPicks() {
  const [picks, setPicks] = useState<PaperPick[]>([]);
  useEffect(() => setPicks(load()), []);
  const update = useCallback((next: (p: PaperPick[]) => PaperPick[]) => {
    setPicks((prev) => {
      const value = next(prev);
      save(value);
      return value;
    });
  }, []);
  const add = useCallback(
    (p: Omit<PaperPick, "id" | "at">) =>
      update((prev) => [
        { ...p, id: `${Date.now().toString(36)}-${p.ticker}`, at: new Date().toISOString() },
        ...prev,
      ]),
    [update],
  );
  const remove = useCallback(
    (id: string) => update((prev) => prev.filter((p) => p.id !== id)),
    [update],
  );
  return { picks, add, remove };
}
