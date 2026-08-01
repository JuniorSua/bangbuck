import snapshot from "@/data/snapshot.json";
import { computeRanking, craftEloOf, DEFAULT_SETTINGS } from "@/lib/score";
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
    /** Every craft figure below is a win probability against this Elo. */
    craftReferenceElo: Math.round(ranking.referenceElo),
    winner: ranking.insights && {
      model: ranking.insights.winner.config.modelDisplay,
      effort: ranking.insights.winner.config.effort,
      bangBuck: Number(ranking.insights.winner.bb.toFixed(2)),
      ship: ranking.insights.winner.ship,
      craft: ranking.insights.winner.craft,
      craftElo: Math.round(craftEloOf(ranking.insights.winner)),
      costPerTask: ranking.insights.winner.config.meanCostUsd,
      tasksSolvedPer100Usd: Math.round(ranking.insights.winner.solvedPer100),
    },
    ranking: ranking.all.map((s) => ({
      rank: s.rank,
      model: s.config.modelDisplay,
      effort: s.config.effort,
      qualified: s.qualified,
      /** Which floor it failed, when it failed one: ship | craft | both | unrated. */
      failed: s.failed,
      bangBuck: s.qualified ? Number(s.bb.toFixed(2)) : null,
      ship: s.ship,
      craft: s.craft,
      craftElo: s.craft === null ? null : Math.round(craftEloOf(s)),
      /** "exact" if Arena rates this effort, "family" if borrowed from a sibling. */
      craftSource: s.craftMatch.kind,
      costPerTask: s.config.meanCostUsd,
      outputTokens: Math.round(s.config.meanOutputTokens),
      agentSteps: Number(s.config.meanAgentSteps.toFixed(1)),
      chatElo: s.arena ? Math.round(s.arena.rating) : null,
    })),
  });
}
