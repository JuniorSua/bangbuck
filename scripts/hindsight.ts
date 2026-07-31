import snapshot from "../data/snapshot.json";
import { computeRanking, DEFAULT_SETTINGS } from "../lib/score";
import type { Snapshot } from "../lib/types";

const snap = snapshot as unknown as Snapshot;

function without(pred: (m: string) => boolean, label: string) {
  const filtered: Snapshot = {
    ...snap,
    deepswe: { ...snap.deepswe, configs: snap.deepswe.configs.filter((c) => !pred(c.model)) },
  };
  const r = computeRanking(filtered, DEFAULT_SETTINGS);
  console.log(`\n=== ${label} ===`);
  console.log(`   ${filtered.deepswe.configs.length} configs, ${r.qualified.length} clear the 65% floor`);
  r.qualified.slice(0, 5).forEach((s, i) =>
    console.log(
      `   ${i + 1}. ${s.label.padEnd(26)} ${(s.config.passAt1 * 100).toFixed(1)}%  $${s.config.meanCostUsd
        .toFixed(2)
        .padStart(6)}  ${(s.config.meanOutputTokens / 1000).toFixed(0).padStart(3)}k tok  ${s.config.meanAgentSteps
        .toFixed(0)
        .padStart(3)} steps   BB ${s.bb.toFixed(2)}`,
    ),
  );
  const lead = r.qualified[1] ? r.qualified[0].bb / r.qualified[1].bb : NaN;
  console.log(`   -> winner leads by ${lead.toFixed(2)}x`);
}

without(() => false, "TODAY — everything included");
without((m) => m === "gpt-5-6-luna", "WITHOUT gpt-5.6-luna only");
without((m) => m.startsWith("gpt-5-6"), "WITHOUT the whole gpt-5.6 generation (luna, sol, terra)");

// Does gpt-5.6-sol [high] beat claude-opus-5 [medium] on every single axis?
const sol = snap.deepswe.configs.find((c) => c.model === "gpt-5-6-sol" && c.effort === "high")!;
const opus = snap.deepswe.configs.find((c) => c.model === "claude-opus-5" && c.effort === "medium")!;
console.log("\n=== Head to head: gpt-5.6-sol [high] vs claude-opus-5 [medium] ===");
const cmp = (name: string, a: number, b: number, lowerBetter = false) => {
  const solWins = lowerBetter ? a < b : a > b;
  console.log(`   ${name.padEnd(16)} sol ${String(a).padStart(9)}   opus ${String(b).padStart(9)}   -> ${solWins ? "SOL WINS" : "opus wins"}`);
};
cmp("pass@1", +(sol.passAt1 * 100).toFixed(1), +(opus.passAt1 * 100).toFixed(1));
cmp("cost", +sol.meanCostUsd.toFixed(2), +opus.meanCostUsd.toFixed(2), true);
cmp("output tokens", Math.round(sol.meanOutputTokens), Math.round(opus.meanOutputTokens), true);
cmp("agent steps", Math.round(sol.meanAgentSteps), Math.round(opus.meanAgentSteps), true);
