import { arenaFor, buildArenaIndex, configLabel, craftFor, organizationFor } from "./normalize";
import type { CraftMatch } from "./normalize";
import type { ArenaEntry, DeepSweConfig, Snapshot } from "./types";

/**
 * The BangBuck formula. Pure — no I/O, no fetch, no dates. This module is the one
 * piece that encodes the actual judgment call, so it is kept isolated and tested
 * against fixed expected values in score.test.ts.
 *
 * ---------------------------------------------------------------------------
 * Why there are two axes
 * ---------------------------------------------------------------------------
 * Version 1 treated capability as one number — DeepSWE pass@1 — and crowned
 * gpt-5.6-luna [max]: 67.2% of tasks solved at $0.61, unbeatable on price.
 *
 * That was wrong, and the way it was wrong is the reason this file looks like it
 * does. DeepSWE measures whether an agent can close a real issue in a real repo.
 * It does not measure whether the code it wrote is any good. On Arena's WebDev
 * board luna sits at 1523 Elo against claude-opus-5's 1703 — a gap that means a
 * human prefers Opus's work about 74% of the time. Luna could finish the job and
 * still hand you something you would not ship.
 *
 * So capability is now two questions, kept separate because they genuinely are:
 *
 *   SHIP  — DeepSWE pass@1. Measured. Can it finish the job?
 *   CRAFT — Arena WebDev Elo. Human-judged. Is the result worth having?
 *
 * They combine GEOMETRICALLY, not as an average:
 *
 *   K = ship^(1 - craftWeight) * craft^craftWeight
 *
 * A geometric mean is conjunctive: a hole on one axis cannot be filled in by a
 * spike on the other, because the product goes to zero with either factor. An
 * arithmetic mean would have let luna's cheap, capable agentic score paper over
 * its weak code — which is the exact failure being corrected.
 *
 * ---------------------------------------------------------------------------
 * Why both floors are hard gates
 * ---------------------------------------------------------------------------
 * Worth knowing before tuning anything: craftWeight barely matters. Sliding it
 * from 0.5 to 0.7 moves every BB score by about 2%, because across qualifying
 * configs craft spans roughly 1.3x while cost spans 20x. Cost dominates the
 * ranking; capability differences are second-order.
 *
 * The consequence is that a soft "bias toward coding" does not work. Weighting
 * alone would still have crowned luna. What changes the answer is the GATE — a
 * config must clear a floor on each axis independently, and failing either one
 * removes it entirely. The weight shapes the order within the survivors; the
 * floors decide who survives. Both floors are therefore expressed as plain
 * percentages, because they are the knobs that actually carry the judgment.
 */

export interface Settings {
  /** Minimum pass@1 (0..1) on the Ship axis. */
  shipFloor: number;
  /** Minimum Craft probability (0..1) — see craftProbability. */
  craftFloor: number;
  /** How much of combined capability is Craft rather than Ship, 0..1. */
  craftWeight: number;
  /** Output-token penalty exponent. */
  beta: number;
  /** Agent-step penalty exponent. */
  gamma: number;
}

/**
 * Converts a WebDev Elo into "how often a human prefers this model's work over
 * the reference model's" — the standard Elo expectation curve.
 *
 * This exists so the Craft axis is a probability rather than a bare rating.
 * 1667 means nothing on its own; "beats the median model 82% of the time" is a
 * sentence someone can actually act on, and it puts Craft on the same 0..1 scale
 * as pass@1 so the two can be multiplied together honestly.
 */
export function craftProbability(elo: number, referenceElo: number): number {
  return 1 / (1 + Math.pow(10, (referenceElo - elo) / 400));
}

/** Inverse of craftProbability: the Elo a given win rate corresponds to. */
export function craftElo(probability: number, referenceElo: number): number {
  return referenceElo + 400 * Math.log10(probability / (1 - probability));
}

/**
 * Named tiers — the two questions people actually arrive with.
 *
 * High power is the default because it is the one with a decisive answer. At the
 * everyday bar the top two configs land within 4% of each other, which is noise
 * dressed up as a ranking; at the high-power bar the winner leads by 1.36x and is
 * one of the few configs Arena rates exactly rather than by inheritance.
 */
export const TIER_PRESETS = [
  {
    id: "high-power",
    label: "High power",
    shipFloor: 0.725,
    craftFloor: 0.75,
    blurb: "Near-frontier on both axes. For work where a bad result is expensive.",
  },
  {
    id: "everyday",
    label: "Everyday",
    shipFloor: 0.65,
    craftFloor: 0.7,
    blurb: "Good enough to ship, ranked by what it costs you.",
  },
] as const;

export const DEFAULT_SETTINGS: Settings = {
  shipFloor: TIER_PRESETS[0].shipFloor,
  craftFloor: TIER_PRESETS[0].craftFloor,
  craftWeight: 0.6,
  beta: 0.2,
  gamma: 0.2,
};

export interface ScoredConfig {
  config: DeepSweConfig;
  label: string;
  organization: string;
  /** General chat Elo. Context only — never scored. */
  arena: ArenaEntry | null;

  /** Ship axis: pass@1, 0..1. */
  ship: number;
  /** Craft axis as a win probability, 0..1. Null when Arena does not rate it. */
  craft: number | null;
  /** Where the Craft rating came from — exact, borrowed, or absent. */
  craftMatch: CraftMatch;
  /** Combined capability, the geometric blend of ship and craft. */
  capability: number | null;

  /** The BangBuck index. Higher is better. Only meaningful for qualified configs. */
  bb: number;
  qualified: boolean;
  /** Why it failed, when it did — drives the table's dimmed rows. */
  failed: "ship" | "craft" | "both" | "unrated" | null;
  /** 1-based rank among qualified configs; null if gated out. */
  rank: number | null;
  /** Tasks solved per $100 of spend: (100 / cost) * ship. */
  solvedPer100: number;
}

export interface Insights {
  winner: ScoredConfig;
  runnerUp: ScoredConfig | null;
  leadMultiple: number | null;

  /** Highest Ship score in the whole set, regardless of price or craft. */
  frontier: ScoredConfig;
  pctOfFrontierScore: number;
  pctOfFrontierPrice: number;
  cheaperThanFrontier: number;

  /** Cheapest config anywhere with strictly more combined capability. */
  cheapestBetter: ScoredConfig | null;
  cheapestBetterPriceMultiple: number | null;
  cheapestBetterExtraCost: number | null;

  /** Best capability available below the winner's price. */
  bestCheaper: ScoredConfig | null;
  bestCheaperSaving: number | null;

  /**
   * The config a capability-and-price ranking alone would have crowned, when the
   * Craft gate has removed it. Null when Craft changes nothing.
   *
   * This is the whole argument of the site in one row. Without it the ranking
   * just asserts a winner; with it, the reader sees the cheap option that was
   * considered and rejected, and exactly how much worse its code is judged to be.
   */
  bestExcludedOnCraft: ScoredConfig | null;
  /** How often a human prefers the winner's work over that config's. */
  winnerPreferredOverExcluded: number | null;

  qualifiedCount: number;
  totalCount: number;
  /** How many configs Arena rates exactly, rather than by family inheritance. */
  exactCraftCount: number;
}

export interface Ranking {
  /** All configs, qualified ones first in BB order, then the rest by ship. */
  all: ScoredConfig[];
  qualified: ScoredConfig[];
  insights: Insights | null;
  settings: Settings;
  /** Median Elo of the WebDev board — the reference every Craft number is against. */
  referenceElo: number;
}

/**
 * Penalty baselines are the minima across ALL configs, not just qualified ones, so
 * that moving a floor does not silently rescale everyone's BB score.
 */
function baselines(configs: DeepSweConfig[]) {
  return {
    minOutputTokens: Math.min(...configs.map((c) => c.meanOutputTokens)),
    minAgentSteps: Math.min(...configs.map((c) => c.meanAgentSteps)),
  };
}

/**
 * The reference every Craft probability is measured against: the median of the
 * WebDev board. A median rather than the top model because "beats the best model
 * half the time" compresses everything interesting into a narrow band near 0.5,
 * whereas "beats a typical model" spreads the field out and reads plainly.
 */
export function referenceElo(entries: ArenaEntry[]): number {
  if (!entries.length) return 1400;
  const sorted = entries.map((e) => e.rating).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function bangBuck(
  c: DeepSweConfig,
  capability: number,
  s: Settings,
  base: ReturnType<typeof baselines>,
): number {
  const tokenPenalty = Math.pow(c.meanOutputTokens / base.minOutputTokens, s.beta);
  const stepPenalty = Math.pow(c.meanAgentSteps / base.minAgentSteps, s.gamma);
  return (capability * 100) / (c.meanCostUsd * tokenPenalty * stepPenalty);
}

export function computeRanking(snapshot: Snapshot, settings: Settings = DEFAULT_SETTINGS): Ranking {
  const configs = snapshot.deepswe.configs;
  const base = baselines(configs);
  const chatIndex = buildArenaIndex(snapshot.arena?.entries ?? []);
  const webdev = snapshot.arenaWebdev?.entries ?? [];
  const reference = referenceElo(webdev);

  const scored: ScoredConfig[] = configs.map((config) => {
    const craftMatch = craftFor(config, webdev);
    const craft =
      craftMatch.kind === "none" ? null : craftProbability(craftMatch.entry.rating, reference);
    const ship = config.passAt1;
    const capability =
      craft === null
        ? null
        : Math.pow(ship, 1 - settings.craftWeight) * Math.pow(craft, settings.craftWeight);

    const shipOk = ship >= settings.shipFloor;
    const craftOk = craft !== null && craft >= settings.craftFloor;
    const failed: ScoredConfig["failed"] =
      craft === null ? "unrated" : shipOk && craftOk ? null : !shipOk && !craftOk ? "both" : shipOk ? "craft" : "ship";

    return {
      config,
      label: configLabel(config),
      organization: organizationFor(config, arenaFor(config, chatIndex)),
      arena: arenaFor(config, chatIndex),
      ship,
      craft,
      craftMatch,
      capability,
      bb: capability === null ? 0 : bangBuck(config, capability, settings, base),
      qualified: failed === null,
      failed,
      rank: null,
      solvedPer100: (100 / config.meanCostUsd) * ship,
    };
  });

  const qualified = scored.filter((s) => s.qualified).sort((a, b) => b.bb - a.bb);
  qualified.forEach((s, i) => (s.rank = i + 1));

  const gatedOut = scored.filter((s) => !s.qualified).sort((a, b) => b.ship - a.ship);

  return {
    all: [...qualified, ...gatedOut],
    qualified,
    insights: qualified.length ? buildInsights(scored, qualified) : null,
    settings,
    referenceElo: reference,
  };
}

/**
 * The value frontier: configs that nothing else beats on BOTH price and capability.
 *
 * Capability here is the combined two-axis number, so the frontier now reflects
 * craft as well as completion — a cheap config with weak code no longer sits on
 * the line just because it solves tasks. Configs Arena does not rate are left off
 * entirely rather than assumed average.
 *
 * Returned sorted by cost ascending, ready to draw as a polyline.
 */
export function valueFrontier(scored: ScoredConfig[]): ScoredConfig[] {
  const rated = scored.filter((s) => s.capability !== null);
  const dominates = (a: ScoredConfig, b: ScoredConfig) =>
    a.config.meanCostUsd <= b.config.meanCostUsd &&
    a.capability! >= b.capability! &&
    (a.config.meanCostUsd < b.config.meanCostUsd || a.capability! > b.capability!);

  return rated
    .filter((b) => !rated.some((a) => a !== b && dominates(a, b)))
    .sort((x, y) => x.config.meanCostUsd - y.config.meanCostUsd);
}

function buildInsights(all: ScoredConfig[], qualified: ScoredConfig[]): Insights {
  const winner = qualified[0];
  const runnerUp = qualified[1] ?? null;
  const frontier = all.reduce((a, b) => (b.ship > a.ship ? b : a));

  const better = all.filter((s) => s.capability !== null && s.capability > winner.capability!);
  const cheapestBetter = better.length
    ? better.reduce((a, b) => (b.config.meanCostUsd < a.config.meanCostUsd ? b : a))
    : null;

  const cheaper = all.filter(
    (s) => s.capability !== null && s.config.meanCostUsd < winner.config.meanCostUsd,
  );
  const bestCheaper = cheaper.length
    ? cheaper.reduce((a, b) => (b.capability! > a.capability! ? b : a))
    : null;

  // What the Craft gate cost you: the config a capability-and-price ranking alone
  // would have crowned. Deliberately computed against a FIXED everyday ship bar
  // rather than the active tier's, for two reasons. It has to reproduce the same
  // answer whichever tier is selected — this is one fact about the field, not a
  // per-tier statistic. And it must not degenerate: the cheapest config overall is
  // gpt-5.6-luna [low], which is cheap because it barely works, so ranking raw BB
  // with no capability bar at all names a config nobody was ever tempted by.
  //
  // With that bar it reproduces v1's winner exactly, which is the point: the site
  // gets to show the answer it used to give and say why it no longer gives it.
  const shipBar = TIER_PRESETS.find((t) => t.id === "everyday")!.shipFloor;
  const contenders = all.filter((s) => s.ship >= shipBar && s.craft !== null);
  const ignoringCraft = contenders.length
    ? contenders.reduce((a, b) => (b.bb > a.bb ? b : a))
    : null;
  const bestExcludedOnCraft =
    ignoringCraft && ignoringCraft !== winner && ignoringCraft.craft! < winner.craft!
      ? ignoringCraft
      : null;

  return {
    winner,
    runnerUp,
    leadMultiple: runnerUp ? winner.bb / runnerUp.bb : null,

    frontier,
    pctOfFrontierScore: (winner.ship / frontier.ship) * 100,
    pctOfFrontierPrice: (winner.config.meanCostUsd / frontier.config.meanCostUsd) * 100,
    cheaperThanFrontier: frontier.config.meanCostUsd / winner.config.meanCostUsd,

    cheapestBetter,
    cheapestBetterPriceMultiple: cheapestBetter
      ? cheapestBetter.config.meanCostUsd / winner.config.meanCostUsd
      : null,
    cheapestBetterExtraCost: cheapestBetter
      ? cheapestBetter.config.meanCostUsd - winner.config.meanCostUsd
      : null,

    bestCheaper,
    bestCheaperSaving: bestCheaper
      ? winner.config.meanCostUsd - bestCheaper.config.meanCostUsd
      : null,

    bestExcludedOnCraft,
    winnerPreferredOverExcluded:
      bestExcludedOnCraft && bestExcludedOnCraft.craftMatch.kind !== "none"
        ? craftProbability(
            craftEloOf(winner),
            craftEloOf(bestExcludedOnCraft),
          )
        : null,

    qualifiedCount: qualified.length,
    totalCount: all.length,
    exactCraftCount: all.filter((s) => s.craftMatch.kind === "exact").length,
  };
}

/** One band of Craft floors over which the winner does not change. */
export interface CraftRegime {
  /** Inclusive lower bound of the band, 0..1. */
  from: number;
  /** Exclusive upper bound. */
  to: number;
  winner: ScoredConfig | null;
  qualifiedCount: number;
}

/**
 * The Craft floor swept end to end, collapsed into the bands where the answer is
 * actually stable.
 *
 * This exists because the single most useful thing learned while building the
 * two-axis version is invisible in any one ranking: the winner is not a fact
 * about the data, it is a fact about how much you demand. Raise the bar past a
 * threshold and the answer changes identity — and those thresholds are few and
 * far apart, which is worth showing rather than asserting.
 *
 * Breakpoints can only occur AT a craft value present in the data: between two
 * adjacent values no config enters or leaves, so the qualified set is fixed.
 * Evaluating at each distinct value therefore gives exact bands in ~30 passes
 * rather than approximating with a fine scan.
 */
export function craftFloorRegimes(snapshot: Snapshot, settings: Settings): CraftRegime[] {
  const base = computeRanking(snapshot, { ...settings, craftFloor: 0 });
  const values = [...new Set(base.all.map((s) => s.craft).filter((c): c is number => c !== null))]
    .sort((a, b) => a - b);
  if (!values.length) return [];

  const points = [0, ...values];
  const out: CraftRegime[] = [];

  for (let i = 0; i < points.length; i++) {
    const from = points[i];
    const to = i + 1 < points.length ? points[i + 1] : 1;
    const r = computeRanking(snapshot, { ...settings, craftFloor: from });
    const winner = r.qualified[0] ?? null;
    const last = out[out.length - 1];
    // Merge into the previous band when the answer has not moved.
    if (last && last.winner?.label === winner?.label) last.to = to;
    else out.push({ from, to, winner, qualifiedCount: r.qualified.length });
  }
  return out;
}

/** The raw WebDev Elo behind a config's Craft score. */
export function craftEloOf(s: ScoredConfig): number {
  return s.craftMatch.kind === "none" ? 0 : s.craftMatch.entry.rating;
}
