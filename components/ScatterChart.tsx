"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ranking, ScoredConfig } from "@/lib/score";
import { METRICS, metricById, type MetricId } from "@/lib/metrics";
import { chartLayout, type ChartScope } from "@/lib/chart-layout";
import { pct, steps, tokens, usdPrecise } from "@/lib/format";

/** True data paths, collision-separated markers, and a dedicated model-label gutter. */
export function ScatterChart({ ranking }: { ranking: Ranking }) {
  const [metricId, setMetricId] = useState<MetricId>("cost");
  const [scope, setScope] = useState<ChartScope>("qualified");
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const metric = metricById(metricId);
  const layout = useMemo(() => chartLayout(ranking, metricId, scope), [ranking, metricId, scope]);
  const activeLabel = pinned ?? hovered;
  const active = ranking.all.find((row) => row.label === activeLabel);
  const inspected = active ?? ranking.qualified[0] ?? ranking.all[0];
  const focusedFamily = active?.config.model;
  const winner = ranking.qualified[0];
  const { width, height, plot, labelX } = layout;

  const release = () => { setPinned(null); setHovered(null); };
  useEffect(() => {
    if (!pinned) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setPinned(null); setHovered(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  const pin = (row: ScoredConfig) => {
    setPinned((previous) => previous === row.label ? null : row.label);
    setHovered(row.label);
  };
  const color = (row: ScoredConfig) => row.rank === 1 ? "var(--accent)" : row.rank === 2 ? "var(--rank-2)" : row.rank === 3 ? "var(--rank-3)" : "var(--text-secondary)";
  const fade = (model: string) => focusedFamily && focusedFamily !== model ? 0.18 : 1;
  const nearest = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    // SVG can letterbox; its own matrix handles scale and scroll accurately.
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    let distance = 17;
    let found: ScoredConfig | null = null;
    for (const node of layout.nodes) {
      const next = Math.hypot(node.x - point.x, node.y - point.y);
      if (next < distance) { distance = next; found = node.row; }
    }
    return found;
  };

  return (
    <figure className="card chart-card m-0">
      <div className="chart-toolbar">
        <div className="seg" role="group" aria-label="Chart metric">
          {METRICS.map((item) => <button key={item.id} aria-pressed={metricId === item.id}
            onClick={() => { setMetricId(item.id); release(); }}>{item.tab}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Configurations shown">
          <button aria-pressed={scope === "qualified"} onClick={() => { setScope("qualified"); release(); }}>
            Qualified · {ranking.qualified.length}
          </button>
          <button aria-pressed={scope === "all"} onClick={() => { setScope("all"); release(); }}>
            All · {ranking.all.length}
          </button>
        </div>
      </div>
      <figcaption className="chart-intro">
        Every line traces one model through its reasoning efforts. Compare what paying more buys:
        a rising line adds task completion; a flat line adds cost without a higher pass rate.
      </figcaption>

      {layout.nodes.length === 0 ? (
        <div className="py-16 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
          <p>No configurations can be plotted in this view.</p>
          <button className="mt-4 underline underline-offset-4" onClick={() => setScope("all")}>Explore the whole field</button>
        </div>
      ) : (
        <div className="chart-scroll" tabIndex={0} role="region" aria-label="Model graph, scroll horizontally on smaller screens">
          <svg key={`${metricId}:${scope}`} className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="group"
            aria-label={`Task completion against ${metric.axis}. ${layout.nodes.length} configurations. Model labels can be selected to pin an inspection.`}
            onMouseMove={(event) => { if (!pinned) setHovered(nearest(event)?.label ?? null); }}
            onMouseLeave={() => { if (!pinned) setHovered(null); }}
            onClick={(event) => { const row = nearest(event); if (row) pin(row); else release(); }}>
            {/* One string child: split text nodes inside <title> fail hydration. */}
            <title>{`Task completion and ${metric.tab.toLowerCase()}`}</title>
            <desc>Lines follow exact measured positions. Small tethers show where overlapping markers were separated. Model labels occupy a separate column.</desc>
            <text x={plot.left} y={24} fill="var(--text-muted)" fontSize={12}>Tasks completed</text>
            <text x={plot.right} y={24} fill="var(--text-muted)" fontSize={12} textAnchor="end">{metric.higherIsBetter ? "Higher preference" : "More efficient"} →</text>
            <text x={labelX} y={24} fill="var(--text-muted)" fontSize={12}>Model · select to inspect</text>
            <rect x={plot.left} y={plot.top} width={plot.right - plot.left}
              height={Math.max(0, layout.y(ranking.settings.shipFloor) - plot.top)} fill="var(--accent)" opacity={0.025} rx={8} />
            {layout.yTicks.map((tick) => <g key={tick}>
              <line x1={plot.left} x2={plot.right} y1={layout.y(tick)} y2={layout.y(tick)} stroke="var(--gridline)" strokeDasharray="2 6" />
              <text x={plot.left - 14} y={layout.y(tick) + 4} textAnchor="end" fontSize={12} fill="var(--text-muted)">{pct(tick, 1)}</text>
            </g>)}
            {layout.xTicks.map((tick) => <text key={tick} x={layout.x(tick)} y={plot.bottom + 27}
              textAnchor="middle" fontSize={12} fill="var(--text-muted)">{metric.tickLabel(Number(tick.toPrecision(6)))}</text>)}
            <line x1={plot.left} x2={plot.right} y1={layout.y(ranking.settings.shipFloor)} y2={layout.y(ranking.settings.shipFloor)}
              stroke="var(--warning)" opacity={0.5} strokeDasharray="5 6" />
            <text x={plot.left + 8} y={layout.y(ranking.settings.shipFloor) - 9} fill="var(--warning)" fontSize={11}>
              Ship floor {pct(ranking.settings.shipFloor, 1)}
            </text>
            {metricId === "craft" && <>
              <line x1={layout.x(ranking.settings.craftFloor)} x2={layout.x(ranking.settings.craftFloor)} y1={plot.top} y2={plot.bottom}
                stroke="var(--warning)" opacity={0.5} strokeDasharray="5 6" />
              <text x={layout.x(ranking.settings.craftFloor) + 8} y={plot.bottom - 10} fontSize={11} fill="var(--warning)">
                Craft floor {pct(ranking.settings.craftFloor, 0)}
              </text>
            </>}
            {/* Relationships follow actual measurements, never displaced markers. */}
            {layout.families.map((family) => <polyline key={family.id}
              points={family.nodes.map((node) => `${node.dataX},${node.dataY}`).join(" ")}
              fill="none" stroke={family.id === winner?.config.model ? "var(--accent)" : "var(--text-muted)"}
              strokeWidth={family.id === focusedFamily || family.id === winner?.config.model ? 1.8 : 1.1}
              opacity={fade(family.id) * (family.id === winner?.config.model ? 0.65 : 0.32)}
              strokeLinejoin="round" strokeLinecap="round" className="chart-mark" />)}
            {layout.nodes.map((node) => {
              const displaced = Math.hypot(node.x - node.dataX, node.y - node.dataY) > 2;
              const selected = active?.label === node.row.label;
              const podium = node.row.rank !== null && node.row.rank <= 3;
              return <g key={node.row.label} opacity={fade(node.row.config.model)} className="chart-mark" style={{ pointerEvents: "none" }}>
                {displaced && <>
                  <line x1={node.dataX} y1={node.dataY} x2={node.x} y2={node.y} stroke={color(node.row)} strokeWidth={1} opacity={0.5} />
                  <circle cx={node.dataX} cy={node.dataY} r={1.8} fill={color(node.row)} opacity={0.8} />
                </>}
                {selected && <circle cx={node.x} cy={node.y} r={13} fill="none" stroke={color(node.row)} opacity={0.5} />}
                <circle cx={node.x} cy={node.y} r={podium ? 9 : 5}
                  fill={node.row.qualified ? color(node.row) : "var(--surface-1)"}
                  stroke={node.row.qualified ? "var(--surface-1)" : "var(--text-muted)"}
                  strokeWidth={node.row.qualified ? 2 : 1.4} opacity={node.row.qualified ? 1 : 0.75} />
                {podium && <text x={node.x} y={node.y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--page)">{node.row.rank}</text>}
              </g>;
            })}
            <line x1={labelX - 16} x2={labelX - 16} y1={plot.top - 8} y2={plot.bottom + 8} stroke="var(--border)" />
            {layout.labels.map((label) => <g key={label.id} className="chart-label chart-mark" tabIndex={0} role="button"
              aria-label={`Inspect ${label.anchor.row.label}`} aria-pressed={pinned === label.anchor.row.label}
              opacity={fade(label.id)} onMouseMove={(event) => { event.stopPropagation(); if (!pinned) setHovered(label.anchor.row.label); }}
              onFocus={() => { if (!pinned) setHovered(label.anchor.row.label); }}
              onBlur={() => { if (!pinned) setHovered(null); }}
              onClick={(event) => { event.stopPropagation(); pin(label.anchor.row); }}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pin(label.anchor.row); } }}>
              <path d={`M ${label.anchor.x + 8} ${label.anchor.y} L ${plot.right + 12} ${label.anchor.y} L ${labelX - 24} ${label.y} L ${labelX - 8} ${label.y}`}
                fill="none" stroke={color(label.anchor.row)} opacity={label.id === focusedFamily ? 0.7 : 0.2} />
              <rect x={labelX - 6} y={label.y - 14} width={width - labelX + 2} height={28} rx={6}
                fill={label.id === focusedFamily ? "var(--surface-2)" : "transparent"} />
              <text x={labelX + 2} y={label.y + 4} fontSize={12} fontWeight={label.id === winner?.config.model ? 600 : 400} fill={color(label.anchor.row)}>
                {label.display}
              </text>
            </g>)}
            <text x={(plot.left + plot.right) / 2} y={height - 12} textAnchor="middle" fontSize={12} fill="var(--text-muted)">{metric.axis}</text>
          </svg>
        </div>
      )}
      <p className="chart-caption">
        Filled markers qualify; outlined markers fall below a floor. Numbers 1–3 mark the ranked podium.
        Lines connect reasoning efforts from low to max. Small tethers return spaced markers to their exact data positions.
        Axes fit the selected view. Scroll horizontally on smaller screens.
        {layout.omitted > 0 && ` ${layout.omitted} configurations have no value for this axis; inspect them below.`}
      </p>

      <div className="chart-inspector">
        <div className="chart-inspector-head">
          <label className="text-sm" style={{ color: "var(--text-secondary)" }}>
            <span className="mr-3">Inspect a configuration</span>
            <select value={pinned ?? ""} onChange={(event) => {
              const row = ranking.all.find((item) => item.label === event.target.value);
              setPinned(row?.label ?? null); setHovered(null);
              if (row && !row.qualified) setScope("all");
            }}>
              <option value="">Hover a marker or choose a model</option>
              {ranking.all.map((row) => <option key={row.label} value={row.label}>{row.label}</option>)}
            </select>
          </label>
          {pinned ? <button className="text-sm" style={{ color: "var(--accent)" }} onClick={release}>Unpin · Esc</button>
            : <span className="text-xs" style={{ color: "var(--text-muted)" }}>Hover to inspect · click to pin</span>}
        </div>
        {inspected && <div aria-live="polite" aria-atomic="true">
          <div className="mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <strong className="text-base font-medium">{inspected.label}</strong>
            <span className="text-xs" style={{ color: inspected.qualified ? "var(--accent)" : "var(--warning)" }}>
              {inspected.qualified ? `Rank ${inspected.rank} · clears both floors` : inspected.failed === "unrated" ? "Craft unrated" : `Below ${inspected.failed === "both" ? "both floors" : `${inspected.failed} floor`}`}
            </span>
          </div>
          <dl className="chart-detail-grid">
            <Detail label="Pass@1" value={pct(inspected.ship, 1)} />
            <Detail label="Craft" value={inspected.craft === null ? "Unrated" : pct(inspected.craft, 1)} />
            <Detail label="Cost / task" value={usdPrecise(inspected.config.meanCostUsd)} />
            <Detail label="Output tokens" value={tokens(inspected.config.meanOutputTokens)} />
            <Detail label="Agent steps" value={steps(inspected.config.meanAgentSteps)} />
            <Detail label="BangBuck" value={inspected.qualified ? inspected.bb.toFixed(2) : "Below floor"} />
          </dl>
          {pinned && <p className="chart-caption">Pinned — click again or press Esc to release.</p>}
        </div>}
      </div>
    </figure>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
