/**
 * How sensitive is the answer to each knob?
 *
 * The finding this script exists to keep honest: craftWeight is nearly inert and
 * craftFloor is decisive. If a future tuning ever makes the weight column start
 * changing the winner, the balance between the axes has shifted and the defaults
 * need re-thinking.
 *
 *   npx tsx scripts/sensitivity.ts
 */
import snapshot from "../data/snapshot.json";
import { computeRanking, DEFAULT_SETTINGS } from "../lib/score";
import type { Snapshot } from "../lib/types";

const snap = snapshot as unknown as Snapshot;
const at = (s: Partial<typeof DEFAULT_SETTINGS>) =>
  computeRanking(snap, { ...DEFAULT_SETTINGS, ...s });

console.log("\nSweeping craftWeight at the default tier — the soft 'bias toward coding':\n");
console.log("  weight   #1                         BB      lead");
for (const craftWeight of [0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.9, 1]) {
  const r = at({ craftWeight });
  const w = r.qualified[0];
  console.log(
    `  ${craftWeight.toFixed(2).padStart(5)}    ${w.label.padEnd(26)} ${w.bb.toFixed(2).padStart(6)}` +
      `  ${r.insights!.leadMultiple?.toFixed(2)}x`,
  );
}

console.log("\nSweeping craftFloor with the ship floor held at the everyday bar — the gate:\n");
console.log("  craft floor   #1                         qualify   BB");
for (const craftFloor of [0, 0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85]) {
  const r = at({ shipFloor: 0.65, craftFloor });
  const w = r.qualified[0];
  console.log(
    `  ${(craftFloor * 100).toFixed(0).padStart(9)}%    ${(w?.label ?? "—").padEnd(26)}` +
      ` ${String(r.qualified.length).padStart(5)}   ${w ? w.bb.toFixed(2) : "—"}`,
  );
}

console.log("\nSweeping the token/step penalties at the default tier:\n");
console.log("  beta=gamma   #1                         #2                         gap");
for (const b of [0, 0.05, 0.1, 0.2, 0.3, 0.5]) {
  const r = at({ beta: b, gamma: b });
  const [a, c] = r.qualified;
  console.log(
    `  ${b.toFixed(3).padStart(8)}   ${a.label.padEnd(26)} ${(c?.label ?? "—").padEnd(26)}` +
      ` ${c ? (a.bb / c.bb).toFixed(3) + "x" : "—"}`,
  );
}
console.log();
