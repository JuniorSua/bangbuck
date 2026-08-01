import type { DeepSweConfig } from "./types";
import { tokens as fmtTokens, usdPrecise } from "./format";

/**
 * The three axes the chart can plot score against — which are exactly the three
 * inputs the BangBuck formula consumes. Switching tabs is therefore not a
 * decoration: it shows which of the three is actually driving a model's rank.
 *
 * All three run "better to the right", so a reader's spatial intuition survives
 * a tab change: cheaper, leaner, and fewer-steps all move the same direction.
 */
export type MetricId = "cost" | "tokens" | "steps";

export interface Metric {
  id: MetricId;
  tab: string;
  axis: string;
  /** Log for cost only: it spans $0.014-$26.40 and a linear axis buries the field. */
  scale: "log" | "linear";
  get: (c: DeepSweConfig) => number;
  format: (v: number) => string;
  tickLabel: (v: number) => string;
}

export const METRICS: Metric[] = [
  {
    id: "cost",
    tab: "Cost",
    axis: "Avg cost per task — cheaper to the right",
    scale: "log",
    get: (c) => c.meanCostUsd,
    format: usdPrecise,
    tickLabel: (v) => (v < 1 ? `$${v}` : `$${v}`),
  },
  {
    id: "tokens",
    tab: "Output tokens",
    axis: "Avg output tokens per task — leaner to the right",
    scale: "linear",
    get: (c) => c.meanOutputTokens,
    format: fmtTokens,
    tickLabel: (v) => (v === 0 ? "0" : `${Math.round(v / 1000)}k`),
  },
  {
    id: "steps",
    tab: "Agent steps",
    axis: "Avg agent steps per task — fewer to the right",
    scale: "linear",
    get: (c) => c.meanAgentSteps,
    format: (v) => v.toFixed(0),
    tickLabel: (v) => String(Math.round(v)),
  },
];

export const metricById = (id: MetricId): Metric => METRICS.find((m) => m.id === id)!;

/**
 * Round tick steps a reader can do arithmetic with (1, 2, 2.5, 5 × 10^n).
 *
 * Picks the candidate whose resulting tick COUNT lands closest to target, rather
 * than the first step at or above max/target. The naive version overshoots badly
 * at the boundary: 276k output tokens gave a 100k step and only three labels,
 * when 50k gives six and reads far better.
 */
export function linearTicks(max: number, target = 5): number[] {
  const mag = Math.pow(10, Math.floor(Math.log10(max / target)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag);
  const step = candidates.reduce((best, s) =>
    Math.abs(Math.floor(max / s) - target) < Math.abs(Math.floor(max / best) - target) ? s : best,
  );
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(v);
  return out;
}

export const LOG_COST_TICKS = [0.02, 0.05, 0.1, 0.5, 1, 5, 10, 25];
