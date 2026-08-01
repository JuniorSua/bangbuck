import type { Insights } from "@/lib/score";
import { craftEloOf } from "@/lib/score";
import { multiple, pct, steps, tokens, usdPrecise } from "@/lib/format";
import { VendorMark } from "./VendorMark";

/**
 * The headline. This component is essentially the whole product: it names one
 * config and then argues for it with numbers the reader can check.
 */
export function WinnerCard({ insights }: { insights: Insights | null }) {
  if (!insights) {
    return (
      <div className="card p-8 text-center">
        <p style={{ color: "var(--text-secondary)" }}>
          No config clears both floors. Lower the Ship or Craft floor to see results.
        </p>
      </div>
    );
  }

  const w = insights.winner;
  const c = w.config;

  return (
    <section className="card overflow-hidden">
      <div className="border-b p-6 sm:p-8" style={{ borderColor: "var(--border)" }}>
        <div
          className="mb-3 text-xs font-medium uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          Best bang for your buck right now
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2
            className="tight text-[2.1rem] font-semibold leading-none sm:text-[3rem]"
            style={{ color: "var(--accent)" }}
          >
            {c.modelDisplay}
          </h2>
          {c.effort && (
            <span
              className="font-mono text-sm uppercase tracking-[0.1em]"
              style={{ color: "var(--text-secondary)" }}
            >
              {c.effort}
            </span>
          )}
          <span
            className="flex items-center gap-1.5 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            <VendorMark organization={w.organization} size={13} />
            {w.organization}
          </span>
        </div>

        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          It finishes{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {pct(w.ship, 1)} of real repo tasks at {usdPrecise(c.meanCostUsd)} each
          </strong>, and humans prefer its web work to a typical model&rsquo;s{" "}
          <strong style={{ color: "var(--text-primary)" }}>{pct(w.craft ?? 0, 0)} of the time</strong>
          {insights.leadMultiple && insights.runnerUp && (
            <>
              {" "}
              — a BangBuck score {multiple(insights.leadMultiple)} the next best option,{" "}
              {insights.runnerUp.label}
            </>
          )}
          .
        </p>
      </div>

      {/* Hero stat: the single number that makes the case. */}
      <div className="border-b p-6 sm:p-8" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
          <div>
            <div
              className="mb-1 text-xs uppercase tracking-[0.12em]"
              style={{ color: "var(--text-muted)" }}
            >
              Tasks solved per $100 spent
            </div>
            <div className="flex items-end gap-4">
              <div
                className="tight text-[3.5rem] font-semibold leading-none tnum sm:text-[4.5rem]"
                style={{ color: "var(--accent)" }}
              >
                {Math.round(w.solvedPer100)}
              </div>
              <div className="pb-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                vs{" "}
                <span className="tnum font-medium" style={{ color: "var(--text-primary)" }}>
                  {Math.round(insights.frontier.solvedPer100)}
                </span>{" "}
                for the top-scoring model
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {insights.frontier.label}
                </div>
              </div>
            </div>
          </div>

          <Stat label="BangBuck score" value={w.bb.toFixed(2)} accent />
          <Stat label="Ship" value={pct(w.ship, 1)} sub={`±${((c.ciHi - c.ciLo) / 2 * 100).toFixed(0)}%`} />
          <Stat label="Craft" value={pct(w.craft ?? 0, 0)} sub={`${craftEloOf(w).toFixed(0)} Elo`} />
          <Stat label="Avg cost / task" value={usdPrecise(c.meanCostUsd)} />
          <Stat label="Output tokens" value={tokens(c.meanOutputTokens)} />
          <Stat label="Agent steps" value={steps(c.meanAgentSteps)} />
        </div>
      </div>

      <div className="p-6 sm:p-8">
        <div
          className="mb-4 text-xs font-medium uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          Why it wins
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          <Reason>
            <strong style={{ color: "var(--text-primary)" }}>
              {insights.pctOfFrontierScore.toFixed(0)}% of the top score for{" "}
              {insights.pctOfFrontierPrice.toFixed(1)}% of the price.
            </strong>{" "}
            {pct(c.passAt1, 1)} vs {insights.frontier.label}&rsquo;s{" "}
            {pct(insights.frontier.config.passAt1, 1)}, at {usdPrecise(c.meanCostUsd)} vs{" "}
            {usdPrecise(insights.frontier.config.meanCostUsd)} —{" "}
            {multiple(insights.cheaperThanFrontier)} cheaper.
          </Reason>

          {insights.bestExcludedOnCraft && insights.winnerPreferredOverExcluded && (
            <Reason>
              <strong style={{ color: "var(--text-primary)" }}>
                The cheap answer was considered, and rejected.
              </strong>{" "}
              On completion and price alone the winner would be{" "}
              {insights.bestExcludedOnCraft.label} at{" "}
              {usdPrecise(insights.bestExcludedOnCraft.config.meanCostUsd)} per task. It is out
              because humans prefer this model&rsquo;s web work{" "}
              {pct(insights.winnerPreferredOverExcluded, 0)} of the time — finishing a task and
              writing code worth keeping are not the same skill.
            </Reason>
          )}

          {insights.cheapestBetter && (
            <Reason>
              <strong style={{ color: "var(--text-primary)" }}>
                Beating it on capability costs {multiple(insights.cheapestBetterPriceMultiple!)} more.
              </strong>{" "}
              The cheapest config stronger on the two axes combined is{" "}
              {insights.cheapestBetter.label}, at +
              {usdPrecise(insights.cheapestBetterExtraCost!)} per task.
            </Reason>
          )}

          {insights.bestCheaper && (
            <Reason>
              <strong style={{ color: "var(--text-primary)" }}>Going cheaper costs you.</strong>{" "}
              The strongest option under {usdPrecise(c.meanCostUsd)} is {insights.bestCheaper.label}:
              it saves {usdPrecise(insights.bestCheaperSaving!)} per task, at{" "}
              {pct(insights.bestCheaper.ship, 1)} ship and {pct(insights.bestCheaper.craft ?? 0, 0)}{" "}
              craft against this model&rsquo;s {pct(w.ship, 1)} and {pct(w.craft ?? 0, 0)}.
            </Reason>
          )}

          <Reason>
            <strong style={{ color: "var(--text-primary)" }}>It clears both bars.</strong>{" "}
            {insights.qualifiedCount} of {insights.totalCount} configs are good enough on completion{" "}
            <em>and</em> on judged code quality to be worth running; among those, this one costs the
            least per unit of work. Arena rates it exactly, not by inheritance from a sibling.
          </Reason>

        </ul>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-xs uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div
        className="text-2xl font-semibold tnum"
        style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}
      >
        {value}
        {sub && (
          <span className="ml-1 text-sm font-normal" style={{ color: "var(--text-muted)" }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function Reason({ children }: { children: React.ReactNode }) {
  return (
    <li
      className="card-inset card-inset-hover p-4 text-sm leading-relaxed"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </li>
  );
}
