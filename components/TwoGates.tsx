import type { Insights, Settings } from "@/lib/score";
import { pct } from "@/lib/format";

/**
 * The site's thesis, drawn instead of asserted.
 *
 * Everything else states the two-bar rule in words and numbers: a floor
 * percentage in a slider, a warning-coloured cell in the table. A regular
 * reader still has to assemble the picture themselves. This draws it once —
 * two tracks, a tick where the reader's bar sits, a marker where the winner
 * lands, and a hollow marker where the cheap option they are probably
 * wondering about lands. Clearing both bars stops being a formula and becomes
 * something you can see.
 *
 * The tracks run 0-100% deliberately, not fitted to the data. A fitted domain
 * would make every gap look dramatic; the honest scale shows the winner
 * clearing the bar by a hair on Ship and comfortably on Craft, which is the
 * true shape of the answer.
 */
export function TwoGates({ insights, settings }: { insights: Insights; settings: Settings }) {
  const w = insights.winner;
  const ghost = insights.bestExcludedOnCraft;

  const gates = [
    {
      label: "Finishes the job",
      sub: "DeepSWE pass@1",
      floor: settings.shipFloor,
      winner: w.ship,
      ghost: ghost?.ship ?? null,
      floorLabel: pct(settings.shipFloor, 1),
    },
    {
      label: "Code worth keeping",
      sub: "Arena WebDev, win rate",
      floor: settings.craftFloor,
      winner: w.craft ?? 0,
      ghost: ghost?.craft ?? null,
      floorLabel: pct(settings.craftFloor, 0),
    },
  ];

  return (
    <div className="border-b p-6 sm:p-8" style={{ borderColor: "var(--border)" }}>
      <div
        className="mb-4 text-xs font-medium uppercase tracking-[0.12em]"
        style={{ color: "var(--text-muted)" }}
      >
        The two bars it had to clear
      </div>

      <div className="space-y-5">
        {gates.map((g) => {
          const clears = g.winner >= g.floor;
          return (
            <div key={g.label}>
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {g.label}
                  <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    {g.sub}
                  </span>
                </span>
                <span className="tnum text-xs" style={{ color: "var(--text-secondary)" }}>
                  <strong style={{ color: clears ? "var(--accent)" : "var(--warning)" }}>
                    {pct(g.winner, 1)}
                  </strong>{" "}
                  vs your {g.floorLabel} bar
                </span>
              </div>

              {/* The track. Positions are percentages of a 0-100 domain, so no
                  scale function is needed and nothing here can drift between
                  server and client. */}
              <div className="relative h-6">
                <div
                  className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
                  style={{ background: "var(--baseline)" }}
                />
                {/* Everything below the reader's bar reads as failing ground. */}
                <div
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-l-full"
                  style={{
                    left: 0,
                    width: `${(g.floor * 100).toFixed(1)}%`,
                    background: "rgba(250,178,25,0.16)",
                  }}
                />
                {/* The bar itself. */}
                <div
                  className="absolute top-0 h-6 w-px"
                  style={{ left: `${(g.floor * 100).toFixed(1)}%`, background: "var(--warning)" }}
                  aria-hidden="true"
                />
                {/* The cheap option, so its failure is visible rather than implied. */}
                {g.ghost !== null && (
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                    style={{
                      left: `${(g.ghost * 100).toFixed(1)}%`,
                      borderColor: "var(--text-muted)",
                      background: "var(--surface-1)",
                    }}
                    aria-hidden="true"
                  />
                )}
                {/* The winner. */}
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${(g.winner * 100).toFixed(1)}%`,
                    background: clears ? "var(--accent)" : "var(--warning)",
                    boxShadow: "0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)",
                  }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
      </div>

      {ghost && (
        <p className="mt-4 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2"
            style={{ borderColor: "var(--text-muted)" }}
            aria-hidden="true"
          />
          {ghost.label} — the cheapest credible option at{" "}
          {`$${ghost.config.meanCostUsd.toFixed(2)}`}/task. The hollow markers show why it is not
          the answer.
        </p>
      )}
    </div>
  );
}
