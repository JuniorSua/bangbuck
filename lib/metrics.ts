import type { ScoredConfig } from "./score";
import { tokens as fmtTokens, usdPrecise } from "./format";
import { pct } from "./format";

/**
 * The axes the chart can plot Ship against — which are exactly the inputs the
 * BangBuck formula consumes. Switching tabs is therefore not a decoration: it
 * shows which input is actually driving a model's rank.
 *
 * Every axis runs "better to the right", so a reader's spatial intuition survives
 * a tab change. For the three cost-like metrics that means the scale is inverted;
 * Craft is the one where higher is better, hence `higherIsBetter`.
 */
export type MetricId = "cost" | "tokens" | "steps" | "craft";

export interface Metric {
  id: MetricId;
  tab: string;
  axis: string;
  /** Log for cost only: it spans $0.014-$26.40 and a linear axis buries the field. */
  scale: "log" | "linear";
  /** When true the axis is NOT inverted — larger values already belong on the right. */
  higherIsBetter?: boolean;
  get: (s: ScoredConfig) => number;
  format: (v: number) => string;
  tickLabel: (v: number) => string;
}

export const METRICS: Metric[] = [
  {
    id: "cost",
    tab: "Cost",
    axis: "Avg cost per task — cheaper to the right",
    scale: "log",
    get: (s) => s.config.meanCostUsd,
    format: usdPrecise,
    tickLabel: (v) => (v < 1 ? `$${v}` : `$${v}`),
  },
  {
    id: "tokens",
    tab: "Output tokens",
    axis: "Avg output tokens per task — leaner to the right",
    scale: "linear",
    get: (s) => s.config.meanOutputTokens,
    format: fmtTokens,
    tickLabel: (v) => (v === 0 ? "0" : `${Math.round(v / 1000)}k`),
  },
  {
    id: "steps",
    tab: "Agent steps",
    axis: "Avg agent steps per task — fewer to the right",
    scale: "linear",
    get: (s) => s.config.meanAgentSteps,
    format: (v) => v.toFixed(0),
    tickLabel: (v) => String(Math.round(v)),
  },
  {
    // The one axis that is not an input cost. Plotting Ship against Craft turns
    // the whole argument of the site into a shape: the models that finish tasks
    // cheaply but write code humans reject sit alone on the left.
    id: "craft",
    tab: "Craft",
    axis: "How often a human prefers its web work — better to the right",
    scale: "linear",
    higherIsBetter: true,
    get: (s) => s.craft ?? 0,
    format: (v) => pct(v, 0),
    tickLabel: (v) => pct(v, 0),
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

/**
 * Ticks for an axis that does NOT start at zero.
 *
 * Craft only ever spans about 0.55-0.85, so anchoring its axis at zero would push
 * the entire field into the right third of the plot and waste most of the width.
 * Fitting the domain to the data means the ticks have to be generated inside an
 * arbitrary window rather than counted up from zero.
 */
export function rangeTicks(lo: number, hi: number, target = 5): number[] {
  const span = hi - lo;
  const mag = Math.pow(10, Math.floor(Math.log10(span / target)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag);

  // Score on the tick count actually produced, not on span/step. Because the
  // domain does not start at zero, the two differ by up to one tick, and that is
  // exactly enough to pick a step that yields three labels where seven fit.
  const count = (s: number) => Math.floor(hi / s) - Math.ceil(lo / s) + 1;
  // Candidates ascend, so a strict < keeps the smaller step on a tie — more ticks
  // rather than fewer, which reads better on a narrow axis.
  const step = candidates.reduce((best, s) =>
    Math.abs(count(s) - target) < Math.abs(count(best) - target) ? s : best,
  );
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    // Guard against binary-float drift accumulating across the loop.
    out.push(Number(v.toFixed(10)));
  }
  return out;
}

export const LOG_COST_TICKS = [0.02, 0.05, 0.1, 0.5, 1, 5, 10, 25];
