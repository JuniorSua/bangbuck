/**
 * Prints the full ranking for each named tier. The quickest way to see whether a
 * change to lib/score.ts moved an answer it should not have.
 *
 *   npx tsx scripts/tiers.ts
 */
import snapshot from "../data/snapshot.json";
import {
  computeRanking,
  craftEloOf,
  craftFloorRegimes,
  DEFAULT_SETTINGS,
  TIER_PRESETS,
} from "../lib/score";
import type { Snapshot } from "../lib/types";

const snap = snapshot as unknown as Snapshot;

for (const tier of TIER_PRESETS) {
  const r = computeRanking(snap, {
    ...DEFAULT_SETTINGS,
    shipFloor: tier.shipFloor,
    craftFloor: tier.craftFloor,
  });
  console.log(
    `\n=== ${tier.label}  —  ship >= ${(tier.shipFloor * 100).toFixed(1)}%, ` +
      `craft >= ${(tier.craftFloor * 100).toFixed(0)}%  —  ${r.qualified.length} qualify ===`,
  );
  r.qualified.forEach((s, i) =>
    console.log(
      `  ${String(i + 1).padStart(2)}. ${s.label.padEnd(24)} BB ${s.bb.toFixed(2).padStart(6)}` +
        `  ship ${(s.ship * 100).toFixed(1)}%  craft ${((s.craft ?? 0) * 100).toFixed(0)}%` +
        ` (${craftEloOf(s).toFixed(0)}, ${s.craftMatch.kind})  $${s.config.meanCostUsd.toFixed(2).padStart(6)}`,
    ),
  );
  const i = r.insights!;
  console.log(`  -> ${i.winner.label}, leading by ${i.leadMultiple?.toFixed(2)}x`);
  if (i.bestExcludedOnCraft) {
    console.log(
      `     craft gate removed ${i.bestExcludedOnCraft.label} ` +
        `($${i.bestExcludedOnCraft.config.meanCostUsd.toFixed(2)}); winner preferred ` +
        `${((i.winnerPreferredOverExcluded ?? 0) * 100).toFixed(0)}% of the time`,
    );
  }
}

// How much does the answer depend on the Craft floor rather than on the data?
// Collapsed into the bands where the winner is stable, which is the fastest way
// to see whether a retune moved a threshold it should not have.
console.log("\n=== Craft floor sweep, ship held at each tier ===");
for (const tier of TIER_PRESETS) {
  console.log(`\n  ${tier.label} (ship >= ${(tier.shipFloor * 100).toFixed(1)}%)`);
  for (const r of craftFloorRegimes(snap, { ...DEFAULT_SETTINGS, shipFloor: tier.shipFloor })) {
    console.log(
      `    craft ${(r.from * 100).toFixed(0).padStart(3)}%-${(r.to * 100).toFixed(0).padStart(3)}%` +
        `  ->  ${(r.winner?.label ?? "nothing qualifies").padEnd(24)} (${r.qualifiedCount} qualify)`,
    );
  }
}
