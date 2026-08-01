"use client";

import { useEffect, useMemo, useState } from "react";
import { computeRanking, DEFAULT_SETTINGS, type Settings } from "@/lib/score";
import type { Snapshot } from "@/lib/types";
import { WinnerCard } from "./WinnerCard";
import { Controls } from "./Controls";
import { RankTable } from "./RankTable";
import { ScatterChart } from "./ScatterChart";
import { TradeoffBar } from "./TradeoffBar";
import { BudgetStrip } from "./BudgetStrip";
import { DataProvenance } from "./DataProvenance";
import { Hero } from "./Hero";

/** Compact query-string form, so only knobs moved off default appear in the URL. */
const KEYS: (keyof Settings)[] = ["shipFloor", "craftFloor", "craftWeight", "beta", "gamma"];
const SHORT: Record<keyof Settings, string> = {
  shipFloor: "s",
  craftFloor: "c",
  craftWeight: "w",
  beta: "b",
  gamma: "g",
};

function readSettings(search: string): Settings {
  const q = new URLSearchParams(search);
  const out = { ...DEFAULT_SETTINGS };
  for (const k of KEYS) {
    const raw = q.get(SHORT[k]);
    if (raw === null) continue;
    const v = Number(raw);
    // Anything unparseable or out of range falls back to the default rather than
    // rendering a nonsense ranking from a hand-edited URL.
    if (Number.isFinite(v) && v >= 0 && v <= 1) out[k] = v;
  }
  return out;
}

/**
 * Holds the tuning state. The ranking is recomputed client-side from the snapshot,
 * which is cheap (50 configs) and makes the sliders feel instant.
 *
 * Settings live in the URL so a tuned view is shareable — the formula is a
 * judgment call, and "here is the same data under my assumptions" is the only way
 * to argue with it properly. The URL is written with replaceState so dragging a
 * slider does not fill the back button with intermediate states.
 */
export function Dashboard({ snapshot }: { snapshot: Snapshot }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const ranking = useMemo(() => computeRanking(snapshot, settings), [snapshot, settings]);

  // Read once on mount rather than during render: the server has no location, and
  // initialising state from it directly would mismatch on hydration.
  useEffect(() => {
    const fromUrl = readSettings(window.location.search);
    if (KEYS.some((k) => fromUrl[k] !== DEFAULT_SETTINGS[k])) setSettings(fromUrl);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    for (const k of KEYS) {
      if (settings[k] !== DEFAULT_SETTINGS[k]) q.set(SHORT[k], String(Number(settings[k].toFixed(4))));
    }
    const next = q.toString();
    window.history.replaceState(null, "", next ? `?${next}` : window.location.pathname);
  }, [settings]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <Hero snapshot={snapshot} />

      <div className="space-y-8">
        <WinnerCard insights={ranking.insights} />
        <Controls settings={settings} onChange={setSettings} />
        <TradeoffBar snapshot={snapshot} settings={settings} onChange={setSettings} />
        <div className="card p-6 sm:p-7">
          <ScatterChart ranking={ranking} />
        </div>
        <BudgetStrip ranking={ranking} />
        <RankTable ranking={ranking} />
        <DataProvenance snapshot={snapshot} />
      </div>

      <footer className="mt-10 border-t pt-6 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        BangBuck is an independent efficiency ranking. It does not run benchmarks — it reads
        published results from the projects above and applies a cost-efficiency formula. The formula
        is a judgment call; the sliders above let you disagree with it.
      </footer>
    </main>
  );
}
