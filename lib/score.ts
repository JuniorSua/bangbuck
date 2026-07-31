import { arenaFor, buildArenaIndex, configLabel, organizationFor } from "./normalize";
import type { ArenaEntry, DeepSweConfig, Snapshot } from "./types";

/**
 * The BangBuck formula. Pure — no I/O, no fetch, no dates. This module is the one
 * piece that encodes the actual judgment call, so it is kept isolated and tested
 * against fixed expected values in score.test.ts.
 */

export interface Settings {
  /** Capability floor: minimum pass@1 (0..1) a config must clear to compete. */
  floor: number;
  /** Output-token penalty exponent. */
  beta: number;
  /** Agent-step penalty exponent. */
  gamma: number;
}

export const DEFAULT_SETTINGS: Settings = { floor: 0.65, beta: 0.2, gamma: 0.2 };

/**
 * Named capability tiers — the two questions people actually arrive with.
 *
 * "Everyday" is the general-purpose bar. "High power" is for work where a
 * one-in-three failure rate is not acceptable and you will pay to avoid it;
 * 72.5% is deliberately just below the frontier's 73.6%, which keeps the
 * genuinely top-tier configurations in and everything merely good out.
 */
export const FLOOR_PRESETS = [
  {
    id: "everyday",
    label: "Everyday",
    floor: 0.65,
    blurb: "Good enough for most work, ranked by what it costs you.",
  },
  {
    id: "high-power",
    label: "High power",
    floor: 0.725,
    blurb: "Only near-frontier models. For work where a failure is expensive.",
  },
] as const;

export interface ScoredConfig {
  config: DeepSweConfig;
  label: string;
  organization: string;
  arena: ArenaEntry | null;
  /** The BangBuck index. Higher is better. Only meaningful for qualified configs. */
  bb: number;
  /** Did this config clear the capability floor? */
  qualified: boolean;
  /** 1-based rank among qualified configs; null if below the floor. */
  rank: number | null;
  /** Tasks solved per $100 of spend: (100 / cost) * passAt1. */
  solvedPer100: number;
}

export interface Insights {
  winner: ScoredConfig;
  runnerUp: ScoredConfig | null;
  /** How many times the winner's BB exceeds the runner-up's. */
  leadMultiple: number | null;

  /** Highest-scoring config in the whole set, regardless of price. */
  frontier: ScoredConfig;
  /** Winner's pass@1 as a % of the frontier's. */
  pctOfFrontierScore: number;
  /** Winner's cost as a % of the frontier's. */
  pctOfFrontierPrice: number;
  /** How many times cheaper the winner is than the frontier. */
  cheaperThanFrontier: number;

  /** Cheapest config anywhere that beats the winner on pass@1. */
  cheapestBetter: ScoredConfig | null;
  cheapestBetterPriceMultiple: number | null;
  cheapestBetterPointsGained: number | null;
  cheapestBetterExtraCost: number | null;

  /** Highest-scoring config anywhere that is cheaper than the winner. */
  bestCheaper: ScoredConfig | null;
  bestCheaperSaving: number | null;
  bestCheaperPointsLost: number | null;

  qualifiedCount: number;
  totalCount: number;
}

export interface Ranking {
  /** All configs, qualified ones first in BB order, then the rest by pass@1. */
  all: ScoredConfig[];
  qualified: ScoredConfig[];
  insights: Insights | null;
  settings: Settings;
}

/**
 * Penalty baselines are the minima across ALL configs, not just qualified ones, so
 * that moving the floor slider does not silently rescale everyone's BB score.
 */
function baselines(configs: DeepSweConfig[]) {
  return {
    minOutputTokens: Math.min(...configs.map((c) => c.meanOutputTokens)),
    minAgentSteps: Math.min(...configs.map((c) => c.meanAgentSteps)),
  };
}

export function bangBuck(c: DeepSweConfig, s: Settings, base: ReturnType<typeof baselines>): number {
  const tokenPenalty = Math.pow(c.meanOutputTokens / base.minOutputTokens, s.beta);
  const stepPenalty = Math.pow(c.meanAgentSteps / base.minAgentSteps, s.gamma);
  return (c.passAt1 * 100) / (c.meanCostUsd * tokenPenalty * stepPenalty);
}

export function computeRanking(snapshot: Snapshot, settings: Settings = DEFAULT_SETTINGS): Ranking {
  const configs = snapshot.deepswe.configs;
  const base = baselines(configs);
  const arenaIndex = buildArenaIndex(snapshot.arena?.entries ?? []);

  const scored: ScoredConfig[] = configs.map((config) => {
    const arena = arenaFor(config, arenaIndex);
    return {
      config,
      label: configLabel(config),
      organization: organizationFor(config, arena),
      arena,
      bb: bangBuck(config, settings, base),
      qualified: config.passAt1 >= settings.floor,
      rank: null,
      solvedPer100: (100 / config.meanCostUsd) * config.passAt1,
    };
  });

  const qualified = scored.filter((s) => s.qualified).sort((a, b) => b.bb - a.bb);
  qualified.forEach((s, i) => (s.rank = i + 1));

  const belowFloor = scored
    .filter((s) => !s.qualified)
    .sort((a, b) => b.config.passAt1 - a.config.passAt1);

  return {
    all: [...qualified, ...belowFloor],
    qualified,
    insights: qualified.length ? buildInsights(scored, qualified) : null,
    settings,
  };
}

/**
 * The value frontier: configs that nothing else beats on BOTH price and score.
 *
 * A config is dominated if some other config is at least as cheap AND at least as
 * capable, and strictly better on one of the two — meaning there is no reason to
 * ever pick it. What survives is the genuine set of trade-offs: to move up this
 * line you must pay more, and to save money you must give up score.
 *
 * Returned sorted by cost ascending, ready to draw as a polyline.
 */
export function valueFrontier(scored: ScoredConfig[]): ScoredConfig[] {
  const dominates = (a: ScoredConfig, b: ScoredConfig) =>
    a.config.meanCostUsd <= b.config.meanCostUsd &&
    a.config.passAt1 >= b.config.passAt1 &&
    (a.config.meanCostUsd < b.config.meanCostUsd || a.config.passAt1 > b.config.passAt1);

  return scored
    .filter((b) => !scored.some((a) => a !== b && dominates(a, b)))
    .sort((x, y) => x.config.meanCostUsd - y.config.meanCostUsd);
}

function buildInsights(all: ScoredConfig[], qualified: ScoredConfig[]): Insights {
  const winner = qualified[0];
  const runnerUp = qualified[1] ?? null;
  const frontier = all.reduce((a, b) => (b.config.passAt1 > a.config.passAt1 ? b : a));

  // Cheapest config that beats the winner on raw capability. This is the honest
  // price of "I want a better score than this" — and the core of the argument.
  const better = all.filter((s) => s.config.passAt1 > winner.config.passAt1);
  const cheapestBetter = better.length
    ? better.reduce((a, b) => (b.config.meanCostUsd < a.config.meanCostUsd ? b : a))
    : null;

  // Best config you could get if you insisted on spending less than the winner.
  const cheaper = all.filter((s) => s.config.meanCostUsd < winner.config.meanCostUsd);
  const bestCheaper = cheaper.length
    ? cheaper.reduce((a, b) => (b.config.passAt1 > a.config.passAt1 ? b : a))
    : null;

  return {
    winner,
    runnerUp,
    leadMultiple: runnerUp ? winner.bb / runnerUp.bb : null,

    frontier,
    pctOfFrontierScore: (winner.config.passAt1 / frontier.config.passAt1) * 100,
    pctOfFrontierPrice: (winner.config.meanCostUsd / frontier.config.meanCostUsd) * 100,
    cheaperThanFrontier: frontier.config.meanCostUsd / winner.config.meanCostUsd,

    cheapestBetter,
    cheapestBetterPriceMultiple: cheapestBetter
      ? cheapestBetter.config.meanCostUsd / winner.config.meanCostUsd
      : null,
    cheapestBetterPointsGained: cheapestBetter
      ? (cheapestBetter.config.passAt1 - winner.config.passAt1) * 100
      : null,
    cheapestBetterExtraCost: cheapestBetter
      ? cheapestBetter.config.meanCostUsd - winner.config.meanCostUsd
      : null,

    bestCheaper,
    bestCheaperSaving: bestCheaper
      ? winner.config.meanCostUsd - bestCheaper.config.meanCostUsd
      : null,
    bestCheaperPointsLost: bestCheaper
      ? (winner.config.passAt1 - bestCheaper.config.passAt1) * 100
      : null,

    qualifiedCount: qualified.length,
    totalCount: all.length,
  };
}
