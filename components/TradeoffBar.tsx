"use client";

import { useMemo } from "react";
import { craftFloorRegimes, type Settings } from "@/lib/score";
import type { Snapshot } from "@/lib/types";
import { pct } from "@/lib/format";

/**
 * The Craft floor swept end to end, drawn as the few bands where the answer is
 * actually stable.
 *
 * Every other part of this site answers "what should I use?" for one setting.
 * This answers the question behind it: how much does that answer depend on how
 * demanding you are? It turns out to depend enormously — and to change at three
 * or four sharp thresholds rather than drifting — which is the single most useful
 * thing learned building the two-axis version and is invisible in any one ranking.
 *
 * The bands are clickable, so the exhibit is also the fastest control on the
 * page: you pick an answer you find plausible and it sets the floor that produces
 * it, rather than hunting for that floor with a slider.
 */
export function TradeoffBar({
  snapshot,
  settings,
  onChange,
}: {
  snapshot: Snapshot;
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const regimes = useMemo(() => craftFloorRegimes(snapshot, settings), [snapshot, settings]);

  if (regimes.length < 2) return null;

  // A fixed window rather than one fitted to the bands. Every craft score on the
  // board falls inside it, so no band is ever clipped away, and holding it still
  // means the picture does not reflow into a different shape every time a floor
  // moves. Widths are clipped for DRAWING only — each band still states its own
  // true bounds, because a band that begins at "any" must not claim to begin at
  // wherever the drawing happens to start.
  const LO = 0.5;
  const HI = 0.9;
  const span = HI - LO;
  const width = (r: { from: number; to: number }) =>
    Math.max(0, Math.min(r.to, HI) - Math.max(r.from, LO)) / span;
  const markerPct = ((settings.craftFloor - LO) / span) * 100;

  return (
    <section className="card p-6 sm:p-7">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="tight text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Raise the bar, and the answer changes
        </h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          Click a band to adopt it
        </span>
      </div>
      <p className="mb-6 max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        The winner is not a fact about the models — it is a fact about how much you demand of them.
        Sliding the Craft floor across its whole range gives only{" "}
        <strong style={{ color: "var(--text-secondary)" }}>{regimes.length} distinct answers</strong>,
        and they switch at sharp thresholds rather than drifting. Ship floor held at{" "}
        {pct(settings.shipFloor, 1)}.
      </p>

      <div className="relative">
        {/* Current position, drawn above the bands so it reads as a playhead. */}
        <div
          className="pointer-events-none absolute -top-1 bottom-0 z-10 flex flex-col items-center"
          style={{ left: `${Math.max(0, Math.min(100, markerPct))}%`, transform: "translateX(-50%)" }}
        >
          <div
            className="tnum whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: "var(--text-primary)", color: "var(--page)" }}
          >
            {pct(settings.craftFloor, 0)}
          </div>
          <div className="w-px flex-1" style={{ background: "var(--text-primary)", opacity: 0.5 }} />
        </div>

        <div className="flex gap-1 pt-7">
          {regimes.map((r) => {
            const active = settings.craftFloor >= r.from && settings.craftFloor < r.to;
            const dead = !r.winner;
            return (
              <button
                key={r.from}
                onClick={() => onChange({ ...settings, craftFloor: r.from })}
                className="group min-w-0 text-left"
                style={{ flexGrow: width(r), flexBasis: 0 }}
                aria-pressed={active}
                aria-label={`Craft floor ${r.from === 0 ? "any" : pct(r.from, 0)} to ${pct(
                  r.to,
                  0,
                )}: ${r.winner?.label ?? "nothing qualifies"}`}
              >
                <div
                  className="h-2.5 rounded-sm transition-opacity"
                  style={{
                    background: dead
                      ? "var(--baseline)"
                      : active
                        ? "var(--accent)"
                        : "var(--text-muted)",
                    opacity: dead ? 0.35 : active ? 1 : 0.32,
                  }}
                />
                <div className="mt-2.5 min-w-0">
                  <div
                    className="truncate text-[11px] font-medium"
                    style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}
                  >
                    {r.winner ? r.winner.config.modelDisplay : "nothing qualifies"}
                  </div>
                  {r.winner?.config.effort && (
                    <div
                      className="truncate font-mono text-[9.5px] uppercase tracking-[0.08em]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {r.winner.config.effort}
                    </div>
                  )}
                  <div className="tnum mt-1 truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {r.from === 0 ? "any" : `${pct(r.from, 0)}+`} · {r.qualifiedCount} left
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
