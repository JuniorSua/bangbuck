import { configLabel } from "./normalize";
import type { Snapshot } from "./types";

export interface SnapshotDiff {
  added: string[];
  removed: string[];
  changed: {
    label: string;
    field: "passAt1" | "meanCostUsd" | "meanOutputTokens" | "meanAgentSteps";
    before: number;
    after: number;
    pctChange: number;
  }[];
}

export function isEmpty(d: SnapshotDiff): boolean {
  return !d.added.length && !d.removed.length && !d.changed.length;
}

/**
 * Compares two snapshots. Used by scripts/refresh.ts to show what a re-scrape would
 * change before it overwrites anything — a silent price cut like gpt-5.6-luna's 5x
 * drop should never slip through unnoticed.
 *
 * Also the engine for the planned release watcher: `added` is exactly "a new model
 * config now has a published score and cost".
 */
export function diffSnapshots(before: Snapshot, after: Snapshot, threshold = 0.02): SnapshotDiff {
  const beforeByConfig = new Map(before.deepswe.configs.map((c) => [c.config, c]));
  const afterByConfig = new Map(after.deepswe.configs.map((c) => [c.config, c]));

  const added = after.deepswe.configs
    .filter((c) => !beforeByConfig.has(c.config))
    .map(configLabel);
  const removed = before.deepswe.configs
    .filter((c) => !afterByConfig.has(c.config))
    .map(configLabel);

  const fields = ["passAt1", "meanCostUsd", "meanOutputTokens", "meanAgentSteps"] as const;
  const changed: SnapshotDiff["changed"] = [];

  for (const [config, next] of afterByConfig) {
    const prev = beforeByConfig.get(config);
    if (!prev) continue;
    for (const field of fields) {
      const a = prev[field];
      const b = next[field];
      if (!a) continue;
      const pctChange = (b - a) / a;
      if (Math.abs(pctChange) >= threshold) {
        changed.push({ label: configLabel(next), field, before: a, after: b, pctChange });
      }
    }
  }

  changed.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  return { added, removed, changed };
}

export function formatDiff(d: SnapshotDiff): string {
  if (isEmpty(d)) return "No changes.";
  const lines: string[] = [];
  for (const label of d.added) lines.push(`  + NEW CONFIG  ${label}`);
  for (const label of d.removed) lines.push(`  - REMOVED     ${label}`);
  for (const c of d.changed) {
    const arrow = c.pctChange > 0 ? "up" : "down";
    const pct = (Math.abs(c.pctChange) * 100).toFixed(1);
    lines.push(
      `  ~ ${c.label.padEnd(28)} ${c.field.padEnd(17)} ${fmt(c.before)} -> ${fmt(c.after)}  (${arrow} ${pct}%)`,
    );
  }
  return lines.join("\n");
}

function fmt(n: number): string {
  if (n < 1) return n.toFixed(4);
  if (n < 1000) return n.toFixed(2);
  return Math.round(n).toLocaleString();
}
