import snapshot from "../data/snapshot.json";
import { computeRanking, DEFAULT_SETTINGS } from "../lib/score";
import type { Snapshot } from "../lib/types";
const snap = snapshot as unknown as Snapshot;

for (const floor of [0.65, 0.725]) {
  const r = computeRanking(snap, { ...DEFAULT_SETTINGS, floor });
  console.log(`\n=== floor ${(floor * 100).toFixed(1)}%  —  ${r.qualified.length} configs qualify ===`);
  r.qualified.forEach((s, i) =>
    console.log(
      `  ${i + 1}. ${s.label.padEnd(24)} ${(s.config.passAt1 * 100).toFixed(1)}%  $${s.config.meanCostUsd
        .toFixed(2)
        .padStart(6)}  ${(s.config.meanOutputTokens / 1000).toFixed(0).padStart(3)}k  ${s.config.meanAgentSteps
        .toFixed(0)
        .padStart(3)} steps   BB ${s.bb.toFixed(2)}   ~${Math.round(s.solvedPer100)} solved/$100`,
    ),
  );
  const i = r.insights!;
  console.log(`  -> winner ${i.winner.label}, leads by ${i.leadMultiple?.toFixed(2)}x`);
}
