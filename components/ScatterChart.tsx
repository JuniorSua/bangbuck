"use client";

import { useMemo, useRef, useState } from "react";
import type { Ranking, ScoredConfig } from "@/lib/score";
import { pct, steps, tokens, usdPrecise } from "@/lib/format";

/**
 * Score vs cost, one line per model.
 *
 * Each line traces a single model through its reasoning-effort settings, cheapest
 * to most expensive — so the line shows what buying more effort from that model
 * actually gets you, and where it stops being worth it. Every model is named on the
 * plot; nothing important requires a hover.
 *
 * Colour is NOT the identity channel here. Eighteen models cannot each get a hue
 * that stays distinguishable for colourblind readers, so identity is carried by the
 * direct labels, and colour is spent only on the podium — the top three ranked
 * models, in descending prominence.
 *
 * The three hues are the documented dark-mode categorical slots and are the only
 * trio that clears all-pairs colourblind separation on this surface. Two rules keep
 * that validation true and must not be quietly undone:
 *   1. Ranks 2 and 3 carry labels in their OWN colour. Orange vs aqua is legally
 *      separable for a deuteranope but not comfortably so, and the coloured label
 *      is the secondary encoding that makes it safe.
 *   2. The grey field never renders at full opacity. Aqua collides with raw
 *      --text-muted; it only separates once that grey is composited down.
 *
 * The x-axis MUST stay logarithmic: costs run $0.014–$26.40 and a linear axis
 * crushes everything interesting into the left edge.
 */
const W = 860;
const H = 600;
const PAD = { top: 34, right: 30, bottom: 58, left: 56 };
/** Minimum vertical gap between two labels before they read as one blob. */
const LABEL_GAP = 14.5;

export function ScatterChart({ ranking }: { ranking: Ranking }) {
  const [hover, setHover] = useState<ScoredConfig | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  const all = ranking.all;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const winner = ranking.qualified[0] ?? null;

  const { x, y, families, ticks } = useMemo(() => {
    const costs = all.map((s) => s.config.meanCostUsd);
    const lo = Math.log10(Math.min(...costs) * 0.75);
    const hi = Math.log10(Math.max(...costs) * 1.25);

    // Cost decreases to the right so "better" is up-and-right, matching the
    // orientation of the source leaderboard people arrive from.
    const x = (c: number) => PAD.left + plotW * (1 - (Math.log10(c) - lo) / (hi - lo));
    const y = (p: number) => PAD.top + plotH * (1 - p / 0.8);

    // config.model is the family; effort is the variant along its line.
    const byModel = new Map<string, ScoredConfig[]>();
    for (const s of all) {
      const list = byModel.get(s.config.model) ?? [];
      list.push(s);
      byModel.set(s.config.model, list);
    }

    const families = [...byModel.entries()]
      .map(([model, configs]) => {
        const sorted = [...configs].sort((a, b) => a.config.meanCostUsd - b.config.meanCostUsd);
        // Anchor the label at the setting of this model actually worth running,
        // not its most expensive one. Anchoring at peak score pinned 17 of 18
        // labels into the left third of the plot, because every model peaks at
        // max effort — which is exactly where the crowding came from.
        //
        // Only QUALIFIED configs may anchor. BangBuck is computed for everything,
        // and a near-free config that fails 9 tasks in 10 scores enormously on it,
        // so ranking by raw bb would label each model at its cheapest junk setting.
        // Models with nothing above the floor fall back to their best score.
        const qualified = sorted.filter((s) => s.qualified);
        const anchor = (qualified.length ? qualified : sorted).reduce((a, b) =>
          qualified.length ? (b.bb > a.bb ? b : a) : b.config.passAt1 > a.config.passAt1 ? b : a,
        );
        return { model, display: sorted[0].config.modelDisplay, configs: sorted, anchor };
      });

    return {
      x,
      y,
      families,
      ticks: [0.02, 0.05, 0.1, 0.5, 1, 5, 10, 25].filter(
        (t) => Math.log10(t) >= lo && Math.log10(t) <= hi,
      ),
    };
  }, [all, plotW, plotH]);

  /**
   * Colour is spent only on the podium — the first three DISTINCT models in the
   * ranking (one model can hold two ranked configs). Medals mark the exact
   * configuration that earned the rank, not the model as a whole.
   */
  const podium = useMemo(() => {
    const tiers = [
      { color: "var(--accent)", medal: "\u{1F451}" },
      { color: "var(--rank-2)", medal: "\u{1F948}" },
      { color: "var(--rank-3)", medal: "\u{1F949}" },
    ];
    const byModel = new Map<string, (typeof tiers)[number]>();
    const byConfig = new Map<string, (typeof tiers)[number]>();
    for (const s of ranking.qualified) {
      if (byModel.size >= tiers.length) break;
      if (byModel.has(s.config.model)) continue;
      const tier = tiers[byModel.size];
      byModel.set(s.config.model, tier);
      byConfig.set(s.label, tier);
    }
    return { byModel, byConfig };
  }, [ranking.qualified]);

  /**
   * Nudge labels apart vertically and draw a leader line back to the point.
   *
   * Three things this has to get right, each of which was wrong before:
   *  - Only separate labels whose text actually OVERLAPS horizontally. Two names
   *    at opposite ends of the plot share a row happily; forcing them apart was
   *    what smeared the stack down the left edge.
   *  - Push symmetrically around the midpoint rather than always downward, so no
   *    single label gets dragged 45px away from its own data point.
   *  - Reserve the winner's true height. Its label is two lines, so budgeting one
   *    line for it let neighbours overlap the most important text on the chart.
   */
  const labels = useMemo(() => {
    const top = PAD.top + 8;
    const bottom = H - PAD.bottom - 8;

    const items = families
      .map((f) => {
        const isWinner = f.model === winner?.config.model;
        const cx = x(f.anchor.config.meanCostUsd);
        // Text runs left from the point; flip right only near the y-axis.
        const side: "start" | "end" = cx < 200 ? "start" : "end";
        const dx = side === "end" ? -11 : 11;
        const width = f.display.length * 6.05 + (isWinner ? 14 : 0);
        const x0 = side === "end" ? cx + dx - width : cx + dx;
        return {
          model: f.model,
          display: f.display,
          anchor: f.anchor,
          isWinner,
          side,
          dx,
          x0,
          x1: x0 + width,
          height: isWinner ? 27 : LABEL_GAP,
          cx,
          cy: y(f.anchor.config.passAt1),
          ly: y(f.anchor.config.passAt1),
        };
      })
      .sort((a, b) => a.ly - b.ly);

    const overlapsX = (a: (typeof items)[number], b: (typeof items)[number]) =>
      a.x0 < b.x1 + 6 && b.x0 < a.x1 + 6;

    for (let pass = 0; pass < 5; pass++) {
      for (let i = 1; i < items.length; i++) {
        const a = items[i - 1];
        const b = items[i];
        if (!overlapsX(a, b)) continue;
        const need = (a.height + b.height) / 2;
        const gap = b.ly - a.ly;
        if (gap >= need) continue;
        const push = (need - gap) / 2;
        a.ly -= push;
        b.ly += push;
      }
      for (const l of items) l.ly = Math.min(bottom, Math.max(top, l.ly));
    }
    return items;
  }, [families, x, y, winner]);

  const floorY = y(ranking.settings.floor);
  const dim = (model: string) => focus !== null && focus !== model;

  /**
   * Hover resolves to the NEAREST point to the cursor, measured across the whole
   * plot — not to whichever mark happens to be on top.
   *
   * Per-mark hit targets made densely packed configs unreachable: a small dot
   * drawn earlier sits underneath a larger one drawn later, so claude-opus-5
   * [high] simply could not be hovered because gpt-5.6-terra covered it. Nearest
   * -point has no z-order at all, so every one of the 50 configs is reachable.
   */
  const svgRef = useRef<SVGSVGElement>(null);
  const HIT_RADIUS = 26;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const py = ((e.clientY - box.top) / box.height) * H;

    let best: ScoredConfig | null = null;
    let bestDist = HIT_RADIUS;
    for (const s of all) {
      const dx = x(s.config.meanCostUsd) - px;
      const dy = y(s.config.passAt1) - py;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    if (best?.label !== hover?.label) {
      setHover(best);
      setFocus(best?.config.model ?? null);
    }
  };

  const clearHover = () => {
    setHover(null);
    setFocus(null);
  };

  return (
    <figure className="m-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <figcaption className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
            What each model costs to run well
          </figcaption>
          <p className="mt-1 max-w-lg text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Every line is one model traced through its reasoning-effort settings, cheapest to most
            expensive. A line that climbs steeply is a model where paying more actually buys you
            score; a flat one is money wasted.
          </p>
        </div>
        {/* Four keys, matching exactly the four things colour encodes. A legend
            that named fewer states than the chart shows would be lying. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <Key color="var(--accent)" ring>
            👑 Best value
          </Key>
          <Key color="var(--rank-2)">🥈 Runner-up</Key>
          <Key color="var(--rank-3)">🥉 Third</Key>
          <Key color="var(--text-muted)" faded>
            Everything else
          </Key>
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          onMouseMove={handleMove}
          onMouseLeave={clearHover}
          role="img"
          aria-label={`Score against cost per task for each model across its reasoning-effort settings.${
            winner ? ` Best value: ${winner.label}.` : ""
          }`}
        >
          <defs>
            <linearGradient id="bb-zone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.085" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.012" />
            </linearGradient>
            <radialGradient id="bb-glow">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={Math.max(0, floorY - PAD.top)}
            fill="url(#bb-zone)"
          />

          {[0, 0.2, 0.4, 0.6, 0.8].map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--gridline)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 12}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--text-muted)"
                className="tnum"
              >
                {t * 100}%
              </text>
            </g>
          ))}

          {ticks.map((t) => (
            <text
              key={t}
              x={x(t)}
              y={H - PAD.bottom + 21}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-muted)"
              className="tnum"
            >
              ${t}
            </text>
          ))}

          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={floorY}
            y2={floorY}
            stroke="var(--warning)"
            strokeWidth={1.25}
            strokeDasharray="4 5"
            opacity={0.7}
          />
          <text
            x={W - PAD.right}
            y={floorY + 15}
            textAnchor="end"
            fontSize={10.5}
            fill="var(--warning)"
            opacity={0.85}
          >
            good enough to use — {pct(ranking.settings.floor, 0)}
          </text>

          <text
            x={W - PAD.right}
            y={PAD.top - 13}
            textAnchor="end"
            fontSize={10.5}
            fill="var(--text-muted)"
            style={{ letterSpacing: "0.08em" }}
          >
            CHEAPER →
          </text>

          {/* One polyline per model, through its effort levels. Three weight
              tiers: winner, podium, field. Ranks 2-3 stay THINNER than the
              winner — a saturated hue already reads heavier than blue, so they
              buy their prominence with colour rather than with width. The field
              never renders at full opacity; aqua only separates from grey once
              that grey is composited down. */}
          {families.map((f) => {
            if (f.configs.length < 2) return null;
            const isWinner = f.model === winner?.config.model;
            const tier = podium.byModel.get(f.model);
            return (
              <polyline
                key={`line-${f.model}`}
                points={f.configs
                  .map((s) => `${x(s.config.meanCostUsd)},${y(s.config.passAt1)}`)
                  .join(" ")}
                fill="none"
                stroke={tier ? tier.color : "var(--text-muted)"}
                strokeWidth={isWinner ? 2.25 : tier ? 1.75 : 1.25}
                strokeOpacity={dim(f.model) ? 0.12 : isWinner ? 0.9 : tier ? 0.75 : 0.38}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ transition: "stroke-opacity 120ms" }}
              />
            );
          })}

          {all.map((s) => {
            const isWinner = winner?.label === s.label;
            const isHover = hover?.label === s.label;
            const medalled = podium.byConfig.get(s.label);
            const tier = podium.byModel.get(s.config.model);
            const cx = x(s.config.meanCostUsd);
            const cy = y(s.config.passAt1);
            return (
              <g key={s.label} opacity={dim(s.config.model) ? 0.18 : 1}>
                {isWinner && <circle cx={cx} cy={cy} r={18} fill="url(#bb-glow)" />}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isWinner ? 7 : medalled ? 5.5 : isHover ? 6 : tier ? 4.5 : 3.5}
                  fill={tier ? tier.color : "var(--text-secondary)"}
                  fillOpacity={medalled ? 1 : tier ? 0.8 : 0.45}
                  stroke="var(--surface-1)"
                  strokeWidth={1.75}
                  // Hover is resolved by nearest-point on the SVG, so marks must
                  // not capture pointer events or they reintroduce occlusion.
                  style={{ pointerEvents: "none" }}
                />
                {medalled && (
                  <text
                    x={cx}
                    y={cy - (isWinner ? 13 : 11)}
                    textAnchor="middle"
                    fontSize={isWinner ? 16 : 13}
                    style={{ pointerEvents: "none" }}
                  >
                    {medalled.medal}
                  </text>
                )}
              </g>
            );
          })}

          {labels.map((l) => {
            const isWinner = l.isWinner;
            const anchor = l.side;
            const dx = l.dx;
            // Ranks 2 and 3 MUST carry their own colour here. Orange vs aqua is
            // only marginally separable for a deuteranope; the coloured label is
            // the secondary encoding that makes the palette safe.
            const color = podium.byModel.get(l.model)?.color ?? "var(--text-secondary)";
            return (
              <g
                key={`lab-${l.model}`}
                opacity={dim(l.model) ? 0.2 : 1}
                style={{ pointerEvents: "none" }}
              >
                {Math.abs(l.ly - l.cy) > 1.5 && (
                  <line
                    x1={l.cx + (anchor === "end" ? -6 : 6)}
                    y1={l.cy}
                    x2={l.cx + dx}
                    y2={l.ly}
                    stroke={color}
                    strokeWidth={1}
                    opacity={0.35}
                  />
                )}
                <text
                  x={l.cx + dx}
                  y={l.ly + (isWinner ? -3 : 4)}
                  textAnchor={anchor}
                  fontSize={isWinner ? 13 : 11.5}
                  fontWeight={isWinner ? 600 : 400}
                  fill={color}
                  style={{ paintOrder: "stroke", stroke: "var(--surface-1)", strokeWidth: 4 }}
                >
                  {l.display}
                </text>
                {isWinner && (
                  <text
                    x={l.cx + dx}
                    y={l.ly + 11}
                    textAnchor={anchor}
                    fontSize={10.5}
                    fill="var(--text-secondary)"
                    className="tnum"
                    style={{ paintOrder: "stroke", stroke: "var(--surface-1)", strokeWidth: 4 }}
                  >
                    {l.anchor.config.effort} · {pct(l.anchor.config.passAt1, 1)} ·{" "}
                    {usdPrecise(l.anchor.config.meanCostUsd)}
                  </text>
                )}
              </g>
            );
          })}

          <text
            x={PAD.left + plotW / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-muted)"
          >
            Avg cost per task
          </text>
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border px-3 py-2 text-xs shadow-xl"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              left: `${(x(hover.config.meanCostUsd) / W) * 100}%`,
              top: `${(y(hover.config.passAt1) / H) * 100}%`,
              transform: "translate(-50%, calc(-100% - 16px))",
              minWidth: 186,
            }}
          >
            <div className="mb-1.5 font-medium" style={{ color: "var(--text-primary)" }}>
              {hover.label}
            </div>
            <Row k="Pass@1" v={pct(hover.config.passAt1, 1)} />
            <Row k="Cost / task" v={usdPrecise(hover.config.meanCostUsd)} />
            <Row k="Output tokens" v={tokens(hover.config.meanOutputTokens)} />
            <Row k="Agent steps" v={steps(hover.config.meanAgentSteps)} />
            <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
              <Row
                k="BangBuck"
                v={hover.qualified ? hover.bb.toFixed(1) : "below floor"}
                accent={hover.qualified}
              />
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}

function Key({
  color,
  children,
  ring,
  ringed,
  faded,
}: {
  color: string;
  children: React.ReactNode;
  ring?: boolean;
  ringed?: boolean;
  faded?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
      <span
        className="inline-block rounded-full"
        style={{
          width: ring ? 10 : 8,
          height: ring ? 10 : 8,
          background: color,
          opacity: faded ? 0.4 : 1,
          boxShadow: ring
            ? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent)`
            : ringed
              ? `0 0 0 1.5px ${color}`
              : undefined,
        }}
      />
      {children}
    </span>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-5" style={{ color: "var(--text-secondary)" }}>
      <span>{k}</span>
      <span className="tnum" style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}>
        {v}
      </span>
    </div>
  );
}
