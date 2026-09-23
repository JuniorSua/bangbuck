import { familyKey } from "./normalize";
import type { AaAgentRow, AaData, AaModel } from "./types";

/**
 * Artificial Analysis leaders, one per axis it measures well. A second opinion
 * next to BangBuck's categories, drawn from a different test suite — where the
 * two agree the answer is sturdier, and where they differ the reader should know.
 *
 * "Near the top" means within 10% of the best Intelligence score. Without a
 * bar, "cheapest" and "fastest" crown tiny models nobody would code with.
 */
export const NEAR_TOP = 0.9;

export interface AaLeader {
  id: string;
  label: string;
  blurb: string;
  name: string;
  creator: string | null;
  effort: string | null;
  value: string;
  /** Best entry from a different model family, so one sweep still says something. */
  next: { name: string; effort: string | null; value: string } | null;
}

/** "Fable 5.1 (max)" and "Claude Fable 5.1 XHigh + SWE-2" are one family. */
const agentFamily = (r: AaAgentRow) =>
  r.model.toLowerCase().replace(/^claude\s+/, "").replace(/\(.*$/, "").trim().split(/\s+/).slice(0, 2).join(" ");

function lead<T>(
  items: T[],
  metric: (t: T) => number | null,
  family: (t: T) => string,
  tieBreak: (t: T) => number = () => 0,
): [T, T | null] | null {
  const ranked = items
    .filter((t) => metric(t) !== null)
    .sort((a, b) => metric(b)! - metric(a)! || tieBreak(a) - tieBreak(b));
  if (!ranked.length) return null;
  return [ranked[0], ranked.find((t) => family(t) !== family(ranked[0])) ?? null];
}

export function aaLeaders(aa: AaData): AaLeader[] {
  const models = aa.models;
  if (!models.length) return [];
  const bar = models[0].intelligence * NEAR_TOP;
  const strong = models.filter((m) => m.intelligence >= bar);
  const cost = (m: AaModel) => m.costPerTask ?? Infinity;
  const out: AaLeader[] = [];

  const fromModels = (
    id: string, label: string, blurb: string, pool: AaModel[],
    metric: (m: AaModel) => number | null, format: (v: number) => string, tieBreak?: (m: AaModel) => number,
  ) => {
    const r = lead(pool, metric, (m) => m.family, tieBreak);
    if (!r) return;
    const [w, n] = r;
    out.push({ id, label, blurb, name: w.name, creator: w.creator, effort: w.effort, value: format(metric(w)!),
      next: n && { name: n.name, effort: n.effort, value: format(metric(n)!) } });
  };

  fromModels("smartest", "Smartest overall", "Intelligence Index: 10 tests across agents, code, science and reasoning",
    models, (m) => m.intelligence, (v) => v.toFixed(1), cost);

  const agents = lead(aa.codingAgents, (r) => r.score, agentFamily, (r) => r.costPerTask ?? Infinity);
  if (agents) {
    const label = (r: AaAgentRow) => `${r.model.replace(/\s*\(with fallback\)/, "")} in ${r.agent}` +
      (r.costPerTask !== null ? `, $${r.costPerTask.toFixed(2)}/task` : "");
    const fmt = (r: AaAgentRow) => r.score.toFixed(1);
    out.push({ id: "agent", label: "Best coding agent", blurb: "Coding Agent Index: real repos and terminals, inside each vendor's own agent",
      name: label(agents[0]), creator: agents[0].creator, effort: null, value: fmt(agents[0]),
      next: agents[1] && { name: label(agents[1]), effort: null, value: fmt(agents[1]) } });
  }

  // Ties are common (same count of 198 tasks passed); the cheaper run takes it.
  fromModels("terminal", "Terminal-Bench 4.0", "agentic terminal tasks; a tie goes to the cheaper run",
    models, (m) => m.terminalBench, (v) => `${(v * 100).toFixed(1)}%`, cost);
  fromModels("cheapest", "Cheapest near the top", "lowest cost per AA task within 10% of the top score",
    strong, (m) => (m.costPerTask === null ? null : -m.costPerTask), (v) => `$${(-v).toFixed(2)}/task`);
  fromModels("fastest", "Fastest near the top", "most output tokens per second within 10% of the top score",
    strong, (m) => m.outputSpeed, (v) => `${v.toFixed(0)} tok/s`);
  return out;
}

/**
 * AA's record for a model, matched by family and effort. With no effort given,
 * the family's strongest entry — how a launch is usually first reported.
 */
export function aaFor(aa: AaData, model: string, effort: string | null = null): AaModel | undefined {
  const key = familyKey(model);
  return aa.models.find((m) => familyKey(m.family) === key && (effort === null || m.effort === effort));
}

/** The family's best Coding Agent Index row, if AA has run it in an agent. */
export function aaAgentFor(aa: AaData, model: string): AaAgentRow | undefined {
  const key = familyKey(model).replace(/^claude/, "");
  return aa.codingAgents.find((r) => familyKey(r.model.replace(/\(.*$/, "").trim()).replace(/^claude/, "") === key);
}

/** 1-based position by Intelligence among current models. */
export const aaRank = (aa: AaData, m: AaModel) => aa.models.indexOf(m) + 1;
