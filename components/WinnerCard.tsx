import type { Insights, Settings } from "@/lib/score";
import { craftEloOf } from "@/lib/score";
import { multiple, pct, steps, tokens, usdPrecise } from "@/lib/format";
import { VendorMark } from "./VendorMark";
import { TwoGates } from "./TwoGates";

/**
 * The headline. This component is essentially the whole product: it names one
 * config and then argues for it with numbers the reader can check.
 */
export function WinnerCard({
  insights,
  settings,
}: {
  insights: Insights | null;
  settings: Settings;
}) {
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
    <section className="card card-answer overflow-hidden">
      {/* Asymmetric on purpose. The name and the argument are prose and want a
          measure to read across; the number that settles it wants to be looked
          at, not read. Stacking them made the card a uniform slab and buried the
          one figure a visitor came for. */}
      <div className="grid gap-8 border-b p-6 sm:p-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12" style={{ borderColor: "var(--border)" }}>
        <div>
          <div
            className="mb-3 text-xs font-medium uppercase tracking-[0.12em]"
            style={{ color: "var(--text-muted)" }}
          >
            Best bang for your buck right now
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3
              className="tight text-[2.1rem] font-semibold leading-none sm:text-[3rem]"
              style={{ color: "var(--accent)" }}
            >
              {c.modelDisplay}
            </h3>
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

          <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            It finishes{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {pct(w.ship, 1)} of real repo tasks at {usdPrecise(c.meanCostUsd)} each
            </strong>, and humans prefer its web work to a typical model&rsquo;s{" "}
            <strong style={{ color: "var(--text-primary)" }}>{pct(w.craft ?? 0, 0)} of the time</strong>
            {insights.leadMultiple && insights.runnerUp && (
              <>
                {" "}
                —{" "}
                {insights.leadMultiple < 1.05 ? (
                  // A 1.0x lead is a coin flip, and printing "1.0x better" would
                  // dress noise up as a ranking. Say what it is.
                  <>in a photo finish with {insights.runnerUp.label}</>
                ) : (
                  <>
                    a BangBuck score {multiple(insights.leadMultiple)} the next best option,{" "}
                    {insights.runnerUp.label}
                  </>
                )}
              </>
            )}
            .
          </p>
        </div>

        <div className="flex flex-col justify-center border-t pt-6 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0" style={{ borderColor: "var(--border)" }}>
          <div
            className="mb-1 text-xs uppercase tracking-[0.12em]"
            style={{ color: "var(--text-muted)" }}
          >
            Tasks solved per $100 spent
          </div>
          <div className="flex items-end gap-4">
            <div
              className="tight tnum text-[3.5rem] font-semibold leading-none sm:text-[4.5rem]"
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
      </div>

      {/* The measured row behind the claim. Flat and evenly weighted on purpose:
          these are the inputs, and giving any one of them typographic weight
          would imply it matters more than the formula says it does. */}
      <div className="border-b p-6 sm:p-8" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap gap-x-10 gap-y-6">
          <Stat label="BangBuck score" value={w.bb.toFixed(2)} accent />
          <Stat label="Ship" value={pct(w.ship, 1)} sub={`±${((c.ciHi - c.ciLo) / 2 * 100).toFixed(0)}%`} />
          <Stat label="Craft" value={pct(w.craft ?? 0, 0)} sub={`${craftEloOf(w).toFixed(0)} Elo`} />
          <Stat label="Avg cost / task" value={usdPrecise(c.meanCostUsd)} />
          <Stat label="Output tokens" value={tokens(c.meanOutputTokens)} />
          <Stat label="Agent steps" value={steps(c.meanAgentSteps)} />
        </div>
      </div>

      <TwoGates insights={insights} settings={settings} />

      <div className="p-6 sm:p-8">
        <div
          className="mb-4 text-xs font-medium uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          Why it wins
        </div>
        {/* One claim per line, numbers doing the talking. The long-form argument
            lived here once; it read as homework. */}
        <ul className="grid gap-3 sm:grid-cols-2">
          <Reason>
            <strong style={{ color: "var(--text-primary)" }}>
              {insights.pctOfFrontierScore.toFixed(0)}% of the top score,{" "}
              {insights.pctOfFrontierPrice.toFixed(0)}% of the price
            </strong>{" "}
            — vs {insights.frontier.label} at {usdPrecise(insights.frontier.config.meanCostUsd)}.
          </Reason>

          {insights.bestExcludedOnCraft && insights.winnerPreferredOverExcluded && (
            <Reason>
              <strong style={{ color: "var(--text-primary)" }}>
                The {usdPrecise(insights.bestExcludedOnCraft.config.meanCostUsd)} temptation? Vetoed.
              </strong>{" "}
              Humans prefer this code {pct(insights.winnerPreferredOverExcluded, 0)} of the time over{" "}
              {insights.bestExcludedOnCraft.label}.
            </Reason>
          )}

          {insights.cheapestBetter && (
            <Reason>
              <strong style={{ color: "var(--text-primary)" }}>
                Better costs {multiple(insights.cheapestBetterPriceMultiple!)} more
              </strong>{" "}
              — {insights.cheapestBetter.label}, +{usdPrecise(insights.cheapestBetterExtraCost!)}
              /task.
            </Reason>
          )}

          <Reason>
            <strong style={{ color: "var(--text-primary)" }}>
              {insights.qualifiedCount} of {insights.totalCount} even qualify
            </strong>{" "}
            — and this one is the cheapest of them per unit of work.
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
