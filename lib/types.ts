/** One benchmarked configuration: a model run at a specific reasoning effort. */
export interface DeepSweConfig {
  /** Raw id from the source, e.g. "gpt-5-6-luna". Dots are encoded as hyphens. */
  model: string;
  /** Display form, e.g. "gpt-5.6-luna". */
  modelDisplay: string;
  /** "low" | "medium" | "high" | "xhigh" | "max", or null (kimi-k2-7-code has none). */
  effort: string | null;
  /** Source's own config id, unique per row. */
  config: string;
  harness: string;

  /** Attempt pass rate over scored rollouts, 0..1. */
  passAt1: number;
  /** Tasks with >=1 passing rollout / tasks attempted, 0..1. */
  passAt4: number | null;
  /** 95% confidence bounds on passAt1, 0..1. */
  ciLo: number;
  ciHi: number;
  nRuns: number | null;

  meanCostUsd: number;
  meanOutputTokens: number;
  meanAgentSteps: number;
  meanInputTokens: number | null;
  meanDurationSeconds: number | null;
  medianPeakContextTokens: number | null;
}

/** One entry from arena.ai's human-preference leaderboard. */
export interface ArenaEntry {
  rank: number;
  modelDisplayName: string;
  /** Elo rating. */
  rating: number;
  ratingLower: number;
  ratingUpper: number;
  votes: number;
  organization: string | null;
  license: string | null;
  modelUrl: string | null;
  /** List price, USD per million tokens. Not a measured cost. */
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
  contextLength: number | null;
}

/** One arena.ai leaderboard: a slug plus its ranked entries. */
export interface ArenaBoard {
  sourceUrl: string;
  /** Which arena leaderboard these entries came from. */
  slug: string;
  entries: ArenaEntry[];
}

/** One model at one effort, as Artificial Analysis measured it on its own suite. */
export interface AaModel {
  slug: string;
  /** Model name without effort, e.g. "GPT-6 Astra". */
  name: string;
  creator: string | null;
  /** AA's release slug, e.g. "gpt-6-astra" — shared by every effort. */
  family: string;
  effort: string | null;
  releaseDate: string | null;
  /** Intelligence Index, 0..100. */
  intelligence: number;
  /** Terminal-Bench 4.0 in AA's harness, 0..1. */
  terminalBench: number | null;
  priceIn: number | null;
  priceOut: number | null;
  /** USD per task on AA's suite — not a DeepSWE repo task. */
  costPerTask: number | null;
  outputTokensPerTask: number | null;
  /** Median output tokens/s, medium prompt. */
  outputSpeed: number | null;
}

/** One model running inside its own coding agent (Claude Code, Codex, ...). */
export interface AaAgentRow {
  agent: string;
  creator: string | null;
  /** e.g. "GPT-6 Astra (max)". */
  model: string;
  /** Coding Agent Index, 0..100. */
  score: number;
  costPerTask: number | null;
  /** AA's own DeepSWE v1.1 run in this agent, 0..1. */
  deepswe: number | null;
  terminalBench: number | null;
}

export interface AaData {
  sourceUrl: string;
  /** Current, measured (not estimated) models, best first. */
  models: AaModel[];
  /** Coding Agent Index rows, best first. */
  codingAgents: AaAgentRow[];
}

export interface Snapshot {
  /** When this snapshot was captured by scripts/refresh.ts. */
  capturedAt: string;
  deepswe: {
    /** The benchmark's own generation timestamp. */
    generatedAt: string;
    nTasksInSet: number;
    latestJob: { name: string; finished_at: string } | null;
    sourceUrl: string;
    configs: DeepSweConfig[];
  };
  /** Human-preference Elo over general chat. Context only — never scored. */
  arena: ArenaBoard | null;
  /**
   * Human-preference Elo over WEB DEVELOPMENT. This one is load-bearing: it is
   * the Craft axis, and a config with no entry here cannot be ranked.
   */
  arenaWebdev: ArenaBoard | null;
  /** Independent second opinion. Shown beside the ranking, never scored. */
  artificialAnalysis?: AaData | null;
}
