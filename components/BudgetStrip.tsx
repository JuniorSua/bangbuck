"use client";

import { useState } from "react";
import type { Ranking, ScoredConfig } from "@/lib/score";
import { pct, usdPrecise } from "@/lib/format";

const BUDGETS = [50, 200, 1000];

/**
 * The ranking translated into the only unit anyone actually budgets in: a month
 * of spend.
 *
 * A BangBuck index of 4.92 is comparable but not concrete — nobody has an
 * intuition for it. "$200 buys 24 finished tasks" is a sentence you can hold a
 * decision against, and it is what the whole formula is for.
 *
 * The rejected cheap option is shown alongside deliberately. It genuinely does
 * buy far more finished tasks, and hiding that would be the same dishonesty the
 * Craft axis was added to fix — so both numbers sit side by side and the reader
 * decides. Volume and craft are shown as separate columns rather than multiplied
 * into one score: Craft is a preference probability against a reference model,
 * not a keep-rate, and combining them would invent a statistic the data does not
 * support.
 */
export function BudgetStrip({ ranking }: { ranking: Ranking }) {
  const [budget, setBudget] = useState(200);
  const insights = ranking.insights;
  if (!insights) return null;

  const rows: { s: ScoredConfig; note: string }[] = [
    { s: insights.winner, note: "Best value" },
    ...(insights.bestExcludedOnCraft
      ? [{ s: insights.bestExcludedOnCraft, note: "Cheapest credible — rejected on craft" }]
      : []),
    ...(insights.frontier.label !== insights.winner.label
      ? [{ s: insights.frontier, note: "Highest raw score" }]
      : []),
  ];

  const tasks = (s: ScoredConfig) => (budget / s.config.meanCostUsd) * s.ship;
  const most = Math.max(...rows.map((r) => tasks(r.s)));

  return (
    <section className="card p-6 sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="tight text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            What a month buys
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Finished tasks per month, at measured benchmark cost.
          </p>
        </div>
        <div className="seg" role="group" aria-label="Monthly budget">
          {BUDGETS.map((b) => (
            <button key={b} aria-pressed={budget === b} onClick={() => setBudget(b)}>
              ${b.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3.5">
        {rows.map(({ s, note }, i) => {
          const n = tasks(s);
          return (
            <div key={s.label}>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {s.config.modelDisplay}
                  {s.config.effort && (
                    <span
                      className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {s.config.effort}
                    </span>
                  )}
                  <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    {note}
                  </span>
                </span>
                <span className="tnum text-sm" style={{ color: "var(--text-secondary)" }}>
                  <strong
                    className="text-base"
                    style={{ color: i === 0 ? "var(--accent)" : "var(--text-primary)" }}
                  >
                    {Math.round(n).toLocaleString()}
                  </strong>{" "}
                  tasks
                  <span className="ml-3" style={{ color: "var(--text-muted)" }}>
                    {pct(s.craft ?? 0, 0)} craft · {usdPrecise(s.config.meanCostUsd)}/task
                  </span>
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full"
                style={{ background: "var(--baseline)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(n / most) * 100}%`,
                    background: i === 0 ? "var(--accent)" : "var(--text-muted)",
                    opacity: i === 0 ? 1 : 0.45,
                    transition: "width 200ms",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Volume is not the whole story, which is the point of showing craft beside it. The cheap row
        finishes far more tasks; a human also prefers the top row&rsquo;s work most of the time. Real
        spend will differ from benchmark cost — these are DeepSWE&rsquo;s measured averages over 113
        tasks, not a quote.
      </p>
    </section>
  );
}
