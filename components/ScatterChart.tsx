"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Ranking, ScoredConfig } from "@/lib/score";
import {
  LOG_COST_TICKS,
  METRICS,
  linearTicks,
  metricById,
  rangeTicks,
  type MetricId,
} from "@/lib/metrics";
import { pct, steps as fmtSteps, tokens as fmtTokens, usdPrecise } from "@/lib/format";

/**
 * Score against one of three cost axes, one line per model.
 *
 * Each line traces a single model through its reasoning-effort settings, so it
 * shows what buying more effort from that model actually gets you. The metric
 * tabs switch the x-axis between the three inputs the formula consumes, which
 * makes it possible to see *which* of them is driving a rank.
 *
 * Colour is NOT the identity channel. Eighteen models cannot each hold a hue that
 * survives colourblind separation, so identity is carried by direct labels and
 * colour is spent only on the podium. Two rules keep the validated palette true:
 *   1. Ranks 2 and 3 carry labels in their OWN colour. Orange vs aqua is legally
 *      separable for a deuteranope but not comfortably so; the coloured label is
 *      the secondary encoding that makes it safe.
 *   2. The grey field never renders at full opacity. Aqua collides with raw
 *      --text-muted; it only separates once that grey is composited down.
 */
const W = 860;
const H = 600;
const PAD = { top: 34, right: 30, bottom: 58, left: 56 };
const LABEL_GAP = 14.5;

export function ScatterChart({ ranking }: { ranking: Ranking }) {
  /**
   * The SVG has a fixed 860-unit viewBox scaled to fit its container, so on a
   * 390px phone every label was rendering at about 4.8 real pixels — legible in
   * the code, invisible on the device. Font sizes are therefore multiplied by the
   * inverse of that scale, which keeps them at a constant PHYSICAL size no matter
   * how wide the chart is drawn.
   *
   * Enlarging type inside a fixed viewBox costs room, so past a threshold the
   * chart also thins itself out: fewer ticks, no legend, and only the winner
   * keeps a label. A phone gets the shape of the argument, not the whole atlas.
   */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const px = el.getBoundingClientRect().width;
      if (px > 0) setScale(Math.min(2.4, Math.max(1, W / px)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fs = (base: number) => Math.round(base * scale * 10) / 10;
  const narrow = scale > 1.45;
  // Gutters have to grow with the type or the enlarged axis labels clip.
  const pad = useMemo(() => {
    // Rounded so the derived plot box stays a clean number. These multipliers
    // produce values like 39.099999999999994, which is harmless arithmetically
    // but leaks straight into rect widths in the DOM.
    const g = (base: number, factor: number) => Math.round(base * (narrow ? factor : 1));
    return {
      top: g(PAD.top, 1.15),
      right: g(PAD.right, 1.4),
      bottom: g(PAD.bottom, 1.25),
      left: g(PAD.left, 1.45),
    };
  }, [narrow]);
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const [hover, setHover] = useState<ScoredConfig | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  /**
   * Click pins the inspection in place. Hover alone was fiddly in exactly the
   * regions worth inspecting — the dense clusters — because reading the tooltip
   * means holding the mouse still on a 26px target, and moving toward the
   * tooltip to read it would re-resolve to a different point. A pin survives
   * mouse movement, mouse leave, and reading at leisure; click again, click
   * empty space, or press Escape to release it.
   */
  const [pinned, setPinned] = useState<string | null>(null);
  const [metricId, setMetricId] = useState<MetricId>("cost");
  const metric = metricById(metricId);

  const all = ranking.all;
  const winner = ranking.qualified[0] ?? null;

  const { x, y, families, ticks } = useMemo(() => {
    const values = all.map((s) => metric.get(s));
    const max = Math.max(...values);
    const min = Math.min(...values);

    // Every metric runs better-to-the-right, so switching tabs never flips the
    // reader's sense of which direction is good.
    let rawX: (v: number) => number;
    let ticks: number[];
    if (metric.scale === "log") {
      const lo = Math.log10(min * 0.75);
      const hi = Math.log10(max * 1.25);
      rawX = (v) => pad.left + plotW * (1 - (Math.log10(v) - lo) / (hi - lo));
      ticks = LOG_COST_TICKS.filter((t) => Math.log10(t) >= lo && Math.log10(t) <= hi);
    } else if (metric.higherIsBetter) {
      // Fitted domain, not zero-anchored — see rangeTicks.
      const span = max - min || 1;
      const lo = min - span * 0.12;
      const hi = max + span * 0.08;
      rawX = (v) => pad.left + plotW * ((v - lo) / (hi - lo));
      ticks = rangeTicks(lo, hi);
    } else {
      const hi = max * 1.06;
      rawX = (v) => pad.left + plotW * (1 - v / hi);
      ticks = linearTicks(max);
    }

    /**
     * Both scales round to 2dp, and not for tidiness.
     *
     * `Math.log10` is only implementation-APPROXIMATED by the spec, so Node and
     * the browser are free to disagree in the last bit or two. That is enough to
     * render a point at cx="96.75098312865315" on the server and 96.75098312865306
     * on the client, which React reports as a hydration mismatch — the same class
     * of bug as an unrounded CSS percentage, arriving through a different door.
     *
     * Rounding here rather than at each call site covers every coordinate the
     * chart derives, including the ones built by arithmetic on top of these.
     * The viewBox is 860 units wide and draws at roughly 984px, so a hundredth
     * of a unit is about a hundredth of a pixel: far below anything visible, and
     * it removes the whole class of divergence rather than one instance of it.
     */
    const round = (n: number) => Math.round(n * 100) / 100;
    const x = (v: number) => round(rawX(v));
    const y = (p: number) => round(pad.top + plotH * (1 - p / 0.8));

    const byModel = new Map<string, ScoredConfig[]>();
    for (const s of all) {
      const list = byModel.get(s.config.model) ?? [];
      list.push(s);
      byModel.set(s.config.model, list);
    }

    const families = [...byModel.entries()].map(([model, configs]) => {
      // Sort along the CURRENT axis so lines stay monotone in x on every tab.
      const sorted = [...configs].sort((a, b) => metric.get(a) - metric.get(b));
      // Anchor the label at the setting of this model actually worth running.
      // Anchoring at peak score pinned 17 of 18 labels into the left third,
      // because every model peaks at max effort. Only QUALIFIED configs may
      // anchor: BangBuck is computed for everything, and a near-free config that
      // fails nine tasks in ten scores enormously on it.
      const qualified = sorted.filter((s) => s.qualified);
      const anchor = (qualified.length ? qualified : sorted).reduce((a, b) =>
        qualified.length ? (b.bb > a.bb ? b : a) : b.config.passAt1 > a.config.passAt1 ? b : a,
      );
      return { model, display: sorted[0].config.modelDisplay, configs: sorted, anchor };
    });

    return { x, y, families, ticks };
  }, [all, plotW, plotH, metric, pad]);

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
   * Nudge labels apart vertically, with a leader line back to the point. Three
   * things this has to get right: only separate labels that actually overlap
   * horizontally; push symmetrically rather than always downward; and reserve
   * the winner's true two-line height.
   */
  const labels = useMemo(() => {
    const top = pad.top + 8;
    const bottom = H - pad.bottom - 8;

    // Only models that actually cleared the gate carry a permanent label. At the
    // high-power tier that is three lines instead of eighteen, and the density
    // now tracks the tier the reader chose rather than staying maximal always.
    // Everything else names itself on hover, where `focus` has already dimmed
    // the field down to the one line being read.
    const relevant = families.filter((f) =>
      narrow
        ? f.model === winner?.config.model || f.model === focus
        : f.configs.some((s) => s.qualified) || f.model === focus,
    );

    const items = relevant
      .map((f) => {
        const isWinner = f.model === winner?.config.model;
        const cx = x(metric.get(f.anchor));
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
  }, [families, x, y, winner, metric, focus, narrow, pad]);

  const floorY = y(ranking.settings.shipFloor);
  const dim = (model: string) => focus !== null && focus !== model;

  /**
   * Hover resolves to the NEAREST point to the cursor, not to whichever mark is
   * on top. Per-mark hit targets made dense configs unreachable — a small dot
   * drawn earlier sits under a larger one drawn later, so claude-opus-5 [high]
   * simply could not be hovered because gpt-5.6-terra covered it.
   */
  const svgRef = useRef<SVGSVGElement>(null);
  const HIT_RADIUS = 26;

  const nearest = (e: React.MouseEvent<SVGSVGElement>): ScoredConfig | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const py = ((e.clientY - box.top) / box.height) * H;
    let best: ScoredConfig | null = null;
    let bestDist = HIT_RADIUS;
    for (const s of all) {
      const dist = Math.hypot(x(metric.get(s)) - px, y(s.config.passAt1) - py);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return best;
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const best = nearest(e);
    if (!best || best.label === pinned) {
      // Same point again, or empty space: release.
      setPinned(null);
      setHover(best);
      setFocus(best?.config.model ?? null);
      return;
    }
    setPinned(best.label);
    setHover(best);
    setFocus(best.config.model);
  };

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (pinned) return;
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const py = ((e.clientY - box.top) / box.height) * H;

    let best: ScoredConfig | null = null;
    let bestDist = HIT_RADIUS;
    for (const s of all) {
      const dist = Math.hypot(x(metric.get(s)) - px, y(s.config.passAt1) - py);
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
    if (pinned) return;
    setHover(null);
    setFocus(null);
  };

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(null);
        setHover(null);
        setFocus(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  // A pinned point must not survive a tab switch pointing at stale geometry.
  useEffect(() => {
    setPinned(null);
    setHover(null);
    setFocus(null);
  }, [metricId]);

  return (
    <figure className="m-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <figcaption className="max-w-lg text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Every line is one model traced through its reasoning-effort settings. A line that climbs
          steeply is a model where paying more actually buys score; a flat one is money wasted.
        </figcaption>

        {/* The three tabs are the three inputs to the formula. Switching them
            shows which one is carrying a given model's rank. */}
        <div className="seg" role="group" aria-label="Chart metric">
          {METRICS.map((m) => (
            <button
              key={m.id}
              aria-pressed={metricId === m.id}
              onClick={() => setMetricId(m.id)}
            >
              {m.tab}
            </button>
          ))}
        </div>
      </div>

      <div className={`mb-3 flex-wrap items-center gap-x-4 gap-y-2 text-xs ${narrow ? "hidden" : "flex"}`}>
        <Key color="var(--accent)" ring>
          👑 Best value
        </Key>
        <Key color="var(--rank-2)">🥈 Runner-up</Key>
        <Key color="var(--rank-3)">🥉 Third</Key>
        <Key color="var(--text-muted)" faded>
          {all.length - ranking.qualified.length} gated out
        </Key>
        <span className="ml-auto" style={{ color: "var(--text-muted)" }}>
          Hover to inspect · click to pin
        </span>
      </div>

      <div className="relative" ref={wrapRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ cursor: hover ? "pointer" : "default" }}
          onMouseMove={handleMove}
          onMouseLeave={clearHover}
          onClick={handleClick}
          role="img"
          aria-label={`Score against ${metric.axis} for each model across its reasoning-effort settings.${
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

          {/* Two zones, not one. The accent wash marks where a config is still in
              contention; the flat scrim below the floor pushes the gated-out
              majority visually behind it, which is most of what made this chart
              feel crowded — 46 of 50 marks live down there. */}
          <rect
            x={pad.left}
            y={pad.top}
            width={plotW}
            height={Math.round(Math.max(0, floorY - pad.top) * 100) / 100}
            fill="url(#bb-zone)"
          />
          <rect
            x={pad.left}
            y={floorY}
            width={plotW}
            height={Math.round(Math.max(0, H - pad.bottom - floorY) * 100) / 100}
            fill="var(--page)"
            opacity={0.35}
          />

          {(narrow ? [0, 0.4, 0.8] : [0, 0.2, 0.4, 0.6, 0.8]).map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--gridline)"
                strokeWidth={1}
              />
              <text
                x={pad.left - 12}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={fs(11)}
                fill="var(--text-muted)"
                className="tnum"
              >
                {t * 100}%
              </text>
            </g>
          ))}

          {(narrow ? ticks.filter((_, i) => i % 2 === 0) : ticks).map((t) => (
            <text
              key={t}
              x={x(t)}
              y={H - pad.bottom + 21}
              textAnchor="middle"
              fontSize={fs(11)}
              fill="var(--text-muted)"
              className="tnum"
            >
              {metric.tickLabel(t)}
            </text>
          ))}

          {/* On the Craft tab both gates are visible at once: everything below the
              horizontal line cannot finish the job, everything left of the
              vertical one writes code humans reject. Only the upper-right
              quadrant competes, which is the entire argument in one picture. */}
          {metric.id === "craft" && (
            <>
              <line
                x1={x(ranking.settings.craftFloor)}
                x2={x(ranking.settings.craftFloor)}
                y1={pad.top}
                y2={H - pad.bottom}
                stroke="var(--warning)"
                strokeWidth={1.25}
                strokeDasharray="4 5"
                opacity={0.7}
              />
              <text
                x={x(ranking.settings.craftFloor) - 7}
                y={pad.top + 12}
                textAnchor="end"
                fontSize={fs(10.5)}
                fill="var(--warning)"
                opacity={0.85}
              >
                worth keeping — {pct(ranking.settings.craftFloor, 0)}
              </text>
            </>
          )}

          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={floorY}
            y2={floorY}
            stroke="var(--warning)"
            strokeWidth={1.25}
            strokeDasharray="4 5"
            opacity={0.7}
          />
          <text
            x={W - pad.right}
            y={floorY + 15}
            textAnchor="end"
            fontSize={fs(10.5)}
            fill="var(--warning)"
            opacity={0.85}
          >
            finishes the job — {pct(ranking.settings.shipFloor, 0)}
          </text>

          <text
            x={W - pad.right}
            y={pad.top - 13}
            textAnchor="end"
            fontSize={fs(10.5)}
            fill="var(--text-muted)"
            style={{ letterSpacing: "0.08em" }}
          >
            MORE EFFICIENT →
          </text>

          {/* One polyline per model. Three weight tiers: winner, podium, field.
              Ranks 2-3 stay THINNER than the winner — a saturated hue already
              reads heavier than blue, so they buy prominence with colour. */}
          {families.map((f) => {
            if (f.configs.length < 2) return null;
            const isWinner = f.model === winner?.config.model;
            const tier = podium.byModel.get(f.model);
            return (
              <polyline
                key={`line-${f.model}`}
                points={f.configs
                  .map((s) => `${x(metric.get(s))},${y(s.config.passAt1)}`)
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
            const cx = x(metric.get(s));
            const cy = y(s.config.passAt1);
            return (
              <g key={s.label} opacity={dim(s.config.model) ? 0.18 : 1}>
                {isWinner && <circle cx={cx} cy={cy} r={18} fill="url(#bb-glow)" />}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isWinner ? 7 : medalled ? 5.5 : isHover ? 6 : tier ? 4.5 : s.qualified ? 4 : 3}
                  fill={tier ? tier.color : "var(--text-secondary)"}
                  fillOpacity={medalled ? 1 : tier ? 0.8 : s.qualified ? 0.55 : 0.3}
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
                    fontSize={fs(isWinner ? 16 : 13)}
                    style={{ pointerEvents: "none" }}
                  >
                    {medalled.medal}
                  </text>
                )}
              </g>
            );
          })}

          {labels.map((l) => {
            const color = podium.byModel.get(l.model)?.color ?? "var(--text-secondary)";
            return (
              <g key={`lab-${l.model}`} opacity={dim(l.model) ? 0.2 : 1} style={{ pointerEvents: "none" }}>
                {Math.abs(l.ly - l.cy) > 1.5 && (
                  <line
                    x1={l.cx + (l.side === "end" ? -6 : 6)}
                    y1={l.cy}
                    x2={l.cx + l.dx}
                    y2={l.ly}
                    stroke={color}
                    strokeWidth={1}
                    opacity={0.35}
                  />
                )}
                <text
                  x={l.cx + l.dx}
                  y={l.ly + (l.isWinner ? -3 : 4)}
                  textAnchor={l.side}
                  fontSize={fs(l.isWinner ? 13 : 11.5)}
                  fontWeight={l.isWinner ? 600 : 400}
                  fill={color}
                  style={{ paintOrder: "stroke", stroke: "var(--surface-1)", strokeWidth: 4 }}
                >
                  {l.display}
                </text>
                {l.isWinner && (
                  <text
                    x={l.cx + l.dx}
                    y={l.ly + 11}
                    textAnchor={l.side}
                    fontSize={fs(10.5)}
                    fill="var(--text-secondary)"
                    className="tnum"
                    style={{ paintOrder: "stroke", stroke: "var(--surface-1)", strokeWidth: 4 }}
                  >
                    {l.anchor.config.effort} · {pct(l.anchor.config.passAt1, 1)} ·{" "}
                    {metric.format(metric.get(l.anchor))}
                  </text>
                )}
              </g>
            );
          })}

          <text
            x={pad.left + plotW / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize={fs(11)}
            fill="var(--text-muted)"
          >
            {metric.axis}
          </text>
        </svg>

        {hover && (() => {
          // The medal sits ABOVE its point, so a fixed offset put the card right
          // on top of the crown — hovering the winner hid the very thing that
          // marks it. Clear the medal's own height, and flip the card below the
          // point when there is not enough room above it.
          const medal = podium.byConfig.get(hover.label);
          const isWinnerHover = winner?.label === hover.label;
          const clearance = medal ? (isWinnerHover ? 36 : 30) : 16;
          const py = y(hover.config.passAt1);
          const below = py < 190;
          return (
          <div
            className="pointer-events-none absolute z-10 rounded-md border px-3 py-2 text-xs shadow-xl"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              // Rounded for the same reason the scales are: these are CSS
              // percentages, and the browser truncates those when it parses them.
              // The tooltip only exists after a mouse move so it never actually
              // hydrates, but leaving an unrounded float here invites the bug back
              // the moment something renders it earlier.
              left: `${((x(metric.get(hover)) / W) * 100).toFixed(3)}%`,
              top: `${((py / H) * 100).toFixed(3)}%`,
              transform: below
                ? `translate(-50%, ${medal ? 14 : 16}px)`
                : `translate(-50%, calc(-100% - ${clearance}px))`,
              minWidth: 186,
            }}
          >
            <div className="mb-1.5 font-medium" style={{ color: "var(--text-primary)" }}>
              {hover.label}
            </div>
            <Row k="Pass@1" v={pct(hover.config.passAt1, 1)} />
            <Row k="Cost / task" v={usdPrecise(hover.config.meanCostUsd)} />
            <Row k="Output tokens" v={fmtTokens(hover.config.meanOutputTokens)} />
            <Row k="Agent steps" v={fmtSteps(hover.config.meanAgentSteps)} />
            <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
              <Row
                k="BangBuck"
                v={hover.qualified ? hover.bb.toFixed(1) : "below floor"}
                accent={hover.qualified}
              />
            </div>
            {pinned === hover.label && (
              <div className="mt-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                📌 Pinned — click again or press Esc to release
              </div>
            )}
          </div>
          );
        })()}
      </div>
    </figure>
  );
}

function Key({
  color,
  children,
  ring,
  faded,
}: {
  color: string;
  children: React.ReactNode;
  ring?: boolean;
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
          boxShadow: ring ? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent)` : undefined,
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
