import { describe, expect, it } from "vitest";
import snapshot from "../data/snapshot.json";
import historical from "./fixtures/2026-09-05.json";
import { chartLayout, separateLabels, separateNodes } from "./chart-layout";
import { computeRanking, DEFAULT_SETTINGS, TIER_PRESETS } from "./score";
import { EFFORT_ORDER } from "./normalize";
import { METRICS } from "./metrics";
import type { Snapshot } from "./types";

describe("collision-aware graph layout", () => {
  it("separates coincident markers while retaining every exact anchor", () => {
    const points = Array.from({ length: 35 }, (_, id) => ({ id, x: 200, y: 200 }));
    const placed = separateNodes(points, { left: 10, right: 400, top: 10, bottom: 400 });
    expect(placed).toHaveLength(points.length);
    for (const node of placed) {
      expect([node.dataX, node.dataY]).toEqual([200, 200]);
      for (const other of placed) if (other.id !== node.id) expect(Math.hypot(node.x - other.x, node.y - other.y)).toBeGreaterThanOrEqual(24);
    }
    expect(separateNodes(points, { left: 10, right: 400, top: 10, bottom: 400 })).toEqual(placed);
  });

  it("keeps label lanes apart even when every anchor shares one height", () => {
    const labels = separateLabels(Array.from({ length: 20 }, (_, id) => ({ id, targetY: 80 })), 40, 700, 32);
    expect(labels[0].y).toBeGreaterThanOrEqual(40);
    expect(labels.at(-1)!.y).toBeLessThanOrEqual(700);
    for (let i = 1; i < labels.length; i++) expect(labels[i].y - labels[i - 1].y).toBeGreaterThanOrEqual(32);
  });

  for (const tier of TIER_PRESETS) for (const scope of ["qualified", "all"] as const) {
    it(`${tier.label}, ${scope}: preserves every plotted configuration across all four metrics`, () => {
      const ranking = computeRanking(snapshot as Snapshot, { ...DEFAULT_SETTINGS, shipFloor: tier.shipFloor, craftFloor: tier.craftFloor });
      for (const metric of METRICS) {
        const layout = chartLayout(ranking, metric.id, scope);
        const expected = (scope === "qualified" ? ranking.qualified : ranking.all).filter((row) => metric.id !== "craft" || row.craft !== null);
        expect(layout.nodes.map((node) => node.row.label).sort()).toEqual(expected.map((row) => row.label).sort());
        for (const node of layout.nodes) {
          expect(node.dataX).toBe(layout.x(metric.get(node.row)));
          expect(node.dataY).toBe(layout.y(node.row.ship));
          expect(node.x).toBeGreaterThanOrEqual(layout.plot.left);
          expect(node.x).toBeLessThanOrEqual(layout.plot.right);
          expect(node.y).toBeGreaterThanOrEqual(layout.plot.top);
          expect(node.y).toBeLessThanOrEqual(layout.plot.bottom);
          for (const other of layout.nodes) if (node !== other) {
            expect(Math.hypot(node.x - other.x, node.y - other.y)).toBeGreaterThanOrEqual(24);
          }
        }
        for (let i = 1; i < layout.labels.length; i++) expect(layout.labels[i].y - layout.labels[i - 1].y).toBeGreaterThanOrEqual(32);
        for (const label of layout.labels) {
          expect(label.y).toBeGreaterThanOrEqual(layout.plot.top);
          expect(label.y).toBeLessThanOrEqual(layout.plot.bottom);
        }
        for (const family of layout.families) {
          const efforts = family.nodes.map((node) => EFFORT_ORDER.indexOf(node.row.config.effort as typeof EFFORT_ORDER[number]));
          expect(efforts).toEqual([...efforts].sort((a, b) => a - b));
        }
      }
    });
  }

  it("does not turn missing Craft into a zero-valued graph point", () => {
    const ranking = computeRanking(historical as Snapshot);
    const layout = chartLayout(ranking, "craft", "all");
    expect(layout.omitted).toBe(5);
    expect(layout.nodes.every((node) => node.row.craft !== null)).toBe(true);
  });

  it("handles empty qualification without invalid geometry", () => {
    const ranking = computeRanking(snapshot as Snapshot, { ...DEFAULT_SETTINGS, shipFloor: 1 });
    for (const metric of METRICS) {
      const layout = chartLayout(ranking, metric.id, "qualified");
      expect(layout.nodes).toEqual([]);
      expect(layout.labels).toEqual([]);
      expect(Number.isFinite(layout.height)).toBe(true);
    }
  });
});
