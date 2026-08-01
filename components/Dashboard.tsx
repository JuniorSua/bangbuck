"use client";

import { useMemo, useState } from "react";
import { computeRanking, DEFAULT_SETTINGS, type Settings } from "@/lib/score";
import type { Snapshot } from "@/lib/types";
import { WinnerCard } from "./WinnerCard";
import { Controls } from "./Controls";
import { RankTable } from "./RankTable";
import { ScatterChart } from "./ScatterChart";
import { DataProvenance } from "./DataProvenance";
import { Hero } from "./Hero";

/**
 * Holds the tuning state. The ranking is recomputed client-side from the snapshot,
 * which is cheap (50 configs) and makes the sliders feel instant.
 */
export function Dashboard({ snapshot }: { snapshot: Snapshot }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const ranking = useMemo(() => computeRanking(snapshot, settings), [snapshot, settings]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <Hero snapshot={snapshot} />

      <div className="space-y-8">
        <WinnerCard insights={ranking.insights} />
        <Controls settings={settings} onChange={setSettings} />
        <div className="card p-6 sm:p-7">
          <ScatterChart ranking={ranking} />
        </div>
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
