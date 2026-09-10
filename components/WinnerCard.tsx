import type { Insights, Settings } from "@/lib/score";
import { craftEloOf } from "@/lib/score";
import { multiple, pct, steps, tokens, usdPrecise } from "@/lib/format";
import { VendorMark } from "./VendorMark";
import { CraftEvidence } from "./CraftEvidence";
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
      <div className="answer-primary" style={{ borderColor: "var(--border)" }}>
        <div>
          <div
            className="eyebrow mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            Best bang for your buck right now
          </div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3
              className="tight break-words text-[2rem] font-semibold leading-[1.12] sm:text-[2.7rem]"
              style={{ color: "var(--accent)" }}
            >
              {c.modelDisplay}
            </h3>
            {c.effort && (
              <span
                className="effort-badge uppercase"
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

          <p className="mt-6 max-w-xl text-base leading-[1.8]" style={{ color: "var(--text-secondary)" }}>
            It finishes{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {pct(w.ship, 1)} of real repo tasks at {usdPrecise(c.meanCostUsd)} each
            </strong>, with an estimated WebDev preference against the board median of{" "}
            <strong style={{ color: "var(--text-primary)" }}>{pct(w.craft ?? 0, 0)}</strong>
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
          <CraftEvidence config={w} compact />
          {c.ciLo < settings.shipFloor && c.ciHi >= settings.shipFloor && (
            <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--warning)" }}>
              Ship clears your {pct(settings.shipFloor, 1)} floor by its point estimate.
              Its 95% interval ({pct(c.ciLo, 1)}–{pct(c.ciHi, 1)}) crosses that floor.
            </p>
          )}
        </div>

        <div className="answer-comparison" style={{ borderColor: "var(--border)" }}>
          <div
            className="mb-5 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Tasks solved per $100 spent
          </div>
          <div className="flex flex-col items-start gap-5">
            <div
              className="tight tnum text-[5rem] font-medium leading-none sm:text-[6rem]"
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
      <div className="answer-stats" style={{ borderColor: "var(--border)" }}>
        <div className="contents">
          <Stat label="BangBuck score" value={w.bb.toFixed(2)} accent />
          <Stat label="Ship" value={pct(w.ship, 1)} sub={`${pct(c.ciLo, 1)}–${pct(c.ciHi, 1)} CI`} />
          <Stat label="Craft" value={pct(w.craft ?? 0, 0)} sub={`${craftEloOf(w).toFixed(0)} Elo`} />
          <Stat label="Avg cost / task" value={usdPrecise(c.meanCostUsd)} />
          <Stat label="Output tokens" value={tokens(c.meanOutputTokens)} />
          <Stat label="Agent steps" value={steps(c.meanAgentSteps)} />
        </div>
      </div>

      <details className="answer-details">
        <summary><span>Evidence &amp; why it wins</span></summary>
        <div className="answer-details-body">
          <CraftEvidence config={w} />
          <TwoGates insights={insights} settings={settings} />

      <div className="pt-8">
        <div
          className="mb-4 text-xs font-medium uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          Why it wins
        </div>
        {/* One claim per line, numbers doing the talking. The long-form argument
            lived here once; it read as homework. */}
        <ul className="answer-reasons">
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
                Craft gate excludes {insights.bestExcludedOnCraft.label}.
              </strong>{" "}
              Elo implies {pct(insights.winnerPreferredOverExcluded, 0)} preference against{" "}
              {insights.bestExcludedOnCraft.label}.
            </Reason>
          )}

          {insights.cheapestBetter && (
            <Reason>
              <strong style={{ color: "var(--text-primary)" }}>
                Higher combined capability: {usdPrecise(insights.cheapestBetter.config.meanCostUsd)}/task
              </strong>{" "}
              — {insights.cheapestBetter.label}.
            </Reason>
          )}

          <Reason>
            <strong style={{ color: "var(--text-primary)" }}>
              {insights.qualifiedCount} of {insights.totalCount} even qualify
            </strong>{" "}
            — this one leads on capability, cost, tokens, and steps combined.
          </Reason>
        </ul>
      </div>
        </div>
      </details>
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
      <div className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div
        className="text-[25px] font-medium tnum"
        style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}
      >
        {value}
        {sub && (
          <span className="mt-2 block text-xs font-normal" style={{ color: "var(--text-muted)" }}>
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
      className="answer-reason"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </li>
  );
}
