/**
 * Sensitivity of the sol-vs-opus ordering to the token/step penalties.
 * Run: npx tsx scripts/sensitivity.ts
 */
import snapshot from "../data/snapshot.json";
import { computeRanking } from "../lib/score";
import type { Snapshot } from "../lib/types";

const snap = snapshot as unknown as Snapshot;
const noLuna: Snapshot = {
  ...snap,
  deepswe: { ...snap.deepswe, configs: snap.deepswe.configs.filter((c) => c.model !== "gpt-5-6-luna") },
};

console.log("\nField with gpt-5.6-luna removed. Sweeping the token/step penalties:\n");
console.log("  beta=gamma   #1                          #2                          gap");
for (const b of [0, 0.05, 0.075, 0.1, 0.2, 0.3, 0.5]) {
  const r = computeRanking(noLuna, { floor: 0.65, beta: b, gamma: b });
  const [a, c] = r.qualified;
  console.log(
    `  ${b.toFixed(3).padStart(8)}   ${a.label.padEnd(26)} ${c.label.padEnd(26)} ${(a.bb / c.bb).toFixed(3)}x`,
  );
}

console.log("\nWhere does claude-opus-5 [medium] land as the penalties get STRONGER?\n");
for (const b of [0.2, 0.4, 0.6]) {
  const r = computeRanking(noLuna, { floor: 0.65, beta: b, gamma: b });
  const pos = r.qualified.findIndex((s) => s.label === "claude-opus-5 [medium]") + 1;
  console.log(`  beta=gamma=${b.toFixed(2)}  ->  claude-opus-5 [medium] ranks #${pos}`);
}
