import snapshot from "@/data/snapshot.json";
import { computeRanking, DEFAULT_SETTINGS } from "@/lib/score";
import type { Snapshot } from "@/lib/types";

export const dynamic = "force-static";

/** The computed ranking at default settings, as JSON. */
export function GET() {
  const snap = snapshot as unknown as Snapshot;
  const ranking = computeRanking(snap, DEFAULT_SETTINGS);

  return Response.json({
    capturedAt: snap.capturedAt,
    benchmarkGeneratedAt: snap.deepswe.generatedAt,
    settings: ranking.settings,
    winner: ranking.insights && {
      model: ranking.insights.winner.config.modelDisplay,
      effort: ranking.insights.winner.config.effort,
      bangBuck: Number(ranking.insights.winner.bb.toFixed(2)),
      passAt1: ranking.insights.winner.config.passAt1,
      costPerTask: ranking.insights.winner.config.meanCostUsd,
      tasksSolvedPer100Usd: Math.round(ranking.insights.winner.solvedPer100),
    },
    ranking: ranking.all.map((s) => ({
      rank: s.rank,
      model: s.config.modelDisplay,
      effort: s.config.effort,
      qualified: s.qualified,
      bangBuck: s.qualified ? Number(s.bb.toFixed(2)) : null,
      passAt1: s.config.passAt1,
      costPerTask: s.config.meanCostUsd,
      outputTokens: Math.round(s.config.meanOutputTokens),
      agentSteps: Number(s.config.meanAgentSteps.toFixed(1)),
      arenaElo: s.arena ? Math.round(s.arena.rating) : null,
    })),
  });
}
