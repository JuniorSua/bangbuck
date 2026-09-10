import { EFFORT_ORDER } from "./normalize";
import { metricById, rangeTicks, type MetricId } from "./metrics";
import type { Ranking, ScoredConfig } from "./score";

export type ChartScope = "qualified" | "all";
export interface PositionedNode {
  row: ScoredConfig;
  /** Exact measured position. Family paths always follow these coordinates. */
  dataX: number;
  dataY: number;
  /** Display marker position; a tether discloses any collision displacement. */
  x: number;
  y: number;
}
const round = (value: number) => Math.round(value * 100) / 100;

/** Nearest available positions on expanding rings; deterministic, bounded, no random jitter. */
export function separateNodes<T extends { x: number; y: number }>(
  points: T[], bounds: { left: number; right: number; top: number; bottom: number }, gap = 24,
): (T & { dataX: number; dataY: number })[] {
  const placed: (T & { dataX: number; dataY: number })[] = [];
  for (const point of points) {
    let candidate: { x: number; y: number } | null = null;
    const limit = Math.hypot(bounds.right - bounds.left, bounds.bottom - bounds.top);
    for (let radius = 0; radius <= limit && !candidate; radius += 6) {
      const count = radius === 0 ? 1 : Math.ceil(2 * Math.PI * radius / 6);
      for (let step = 0; step < count; step++) {
        const angle = step * 2 * Math.PI / count - Math.PI / 2;
        const x = round(point.x + Math.cos(angle) * radius);
        const y = round(point.y + Math.sin(angle) * radius);
        if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) continue;
        if (placed.every((other) => Math.hypot(other.x - x, other.y - y) >= gap)) {
          candidate = { x, y };
          break;
        }
      }
    }
    // This plot has capacity well beyond the source field. Fail explicitly if
    // that contract changes rather than silently misrepresenting overlapping nodes.
    if (!candidate) throw new Error("Chart layout needs more space for these configurations.");
    placed.push({ ...point, dataX: point.x, dataY: point.y, ...candidate });
  }
  return placed;
}

/** Place labels in a dedicated gutter, maintaining order and a minimum line spacing. */
export function separateLabels<T extends { targetY: number }>(labels: T[], top: number, bottom: number, gap = 30) {
  const sorted = [...labels].sort((a, b) => a.targetY - b.targetY);
  const positions: (T & { y: number })[] = [];
  for (const label of sorted) {
    positions.push({ ...label, y: Math.max(label.targetY, positions.length ? positions.at(-1)!.y + gap : top) });
  }
  if (positions.length && positions.at(-1)!.y > bottom) {
    positions[positions.length - 1].y = bottom;
    for (let i = positions.length - 2; i >= 0; i--) positions[i].y = Math.min(positions[i].y, positions[i + 1].y - gap);
  }
  return positions.map((label) => ({ ...label, y: round(label.y) }));
}

export function chartLayout(ranking: Ranking, metricId: MetricId, scope: ChartScope) {
  const metric = metricById(metricId);
  const requested = scope === "qualified" ? ranking.qualified : ranking.all;
  // Missing Craft is missing data, not zero preference. It stays inspectable in the selector.
  const rows = requested.filter((row) => (metricId !== "craft" || row.craft !== null) &&
    Number.isFinite(metric.get(row)) && (metric.scale !== "log" || metric.get(row) > 0));
  const familyCount = new Set(rows.map((row) => row.config.model)).size;
  const width = 1080;
  const height = Math.max(530, familyCount * 32 + 128);
  const plot = { left: 68, right: 796, top: 54, bottom: height - 74 };
  const labelX = 840;
  const values = rows.map(metric.get);
  const rawMin = values.length ? Math.min(...values) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;
  let lo: number, hi: number;
  if (metric.scale === "log") {
    lo = Math.log10(Math.max(rawMin, 0.001)) - 0.10;
    hi = Math.log10(Math.max(rawMax, 0.01)) + 0.10;
    if (hi - lo < 0.2) hi = lo + 0.2;
  } else {
    const min = metricId === "craft" ? Math.min(rawMin, ranking.settings.craftFloor) : rawMin;
    const max = metricId === "craft" ? Math.max(rawMax, ranking.settings.craftFloor) : rawMax;
    const padding = Math.max((max - min) * 0.10, metricId === "craft" ? 0.025 : max * 0.025, 0.01);
    lo = Math.max(0, min - padding);
    hi = metricId === "craft" ? Math.min(1, max + padding) : max + padding;
    if (hi <= lo) hi = lo + 1;
  }
  const x = (value: number) => {
    const normalized = ((metric.scale === "log" ? Math.log10(value) : value) - lo) / (hi - lo);
    return round(plot.left + (plot.right - plot.left) * (metric.higherIsBetter ? normalized : 1 - normalized));
  };
  const ships = rows.map((row) => row.ship);
  const minShip = Math.min(ranking.settings.shipFloor, ...ships);
  const maxShip = Math.max(ranking.settings.shipFloor, ...ships);
  const padding = Math.max((maxShip - minShip) * 0.12, 0.025);
  const yLo = Math.max(0, minShip - padding);
  const yHi = Math.min(1, maxShip + padding);
  const y = (value: number) => round(plot.bottom - (plot.bottom - plot.top) * (value - yLo) / (yHi - yLo || 1));
  const nodes: PositionedNode[] = separateNodes(rows.map((row) => ({ row, x: x(metric.get(row)), y: y(row.ship) })), {
    left: plot.left + 10, right: plot.right - 10, top: plot.top + 10, bottom: plot.bottom - 10,
  });
  const byFamily = new Map<string, PositionedNode[]>();
  for (const node of nodes) byFamily.set(node.row.config.model, [...(byFamily.get(node.row.config.model) ?? []), node]);
  const families = [...byFamily].map(([id, familyNodes]) => {
    const anchor = familyNodes.find((node) => node.row.qualified) ?? familyNodes.reduce((best, node) => node.row.ship > best.row.ship ? node : best);
    const ordered = [...familyNodes].sort((a, b) =>
      EFFORT_ORDER.indexOf(a.row.config.effort as typeof EFFORT_ORDER[number]) -
      EFFORT_ORDER.indexOf(b.row.config.effort as typeof EFFORT_ORDER[number]));
    return { id, display: anchor.row.config.modelDisplay, anchor, nodes: ordered, targetY: anchor.y };
  });
  const labels = separateLabels(families, plot.top + 10, plot.bottom - 10, 32);
  const xTicks = metric.scale === "log"
    ? Array.from({ length: 12 }, (_, i) => i - 4).flatMap((power) => [1, 2, 5].map((n) => n * 10 ** power))
      .filter((v) => Math.log10(v) >= lo && Math.log10(v) <= hi)
    : rangeTicks(lo, hi, 5);
  // Avoid crowded decimal labels on broad logarithmic views.
  const thinnedTicks = xTicks.filter((_, index) => index % Math.max(1, Math.ceil(xTicks.length / 7)) === 0);
  return { width, height, plot, labelX, nodes, families, labels, x, y, xTicks: thinnedTicks,
    yTicks: rangeTicks(yLo, yHi, 5), omitted: requested.length - rows.length };
}
