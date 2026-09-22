import { configLabel } from "./normalize";
import { computeRanking, DEFAULT_SETTINGS, TIER_PRESETS } from "./score";
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
  arena: {
    board: "WebDev" | "Chat";
    added: string[];
    removed: string[];
    changed: string[];
  }[];
  reference: { before: number; after: number } | null;
  craftMatches: { label: string; before: string; after: string }[];
  tiers: {
    label: string;
    beforeWinner: string | null;
    afterWinner: string | null;
    beforeCount: number;
    afterCount: number;
    entered: string[];
    left: string[];
  }[];
}

/** Small public change summary, paired to one snapshot by capture timestamp. */
export interface SnapshotUpdate {
  capturedAt: string;
  previousCapturedAt: string;
  tiers: SnapshotDiff["tiers"];
  newWebdev: string[];
  /** Measured cost-per-task moves; absent in summaries written before it existed. */
  costChanges?: { label: string; before: number; after: number }[];
}

export function snapshotUpdate(before: Snapshot, after: Snapshot, diff = diffSnapshots(before, after)): SnapshotUpdate {
  return { capturedAt: after.capturedAt, previousCapturedAt: before.capturedAt,
    tiers: diff.tiers, newWebdev: diff.arena.find((board) => board.board === "WebDev")?.added ?? [],
    costChanges: diff.changed.filter((c) => c.field === "meanCostUsd")
      .map(({ label, before, after }) => ({ label, before, after }))
      .sort((a, b) => a.label.split(" [")[0].localeCompare(b.label.split(" [")[0]) || a.after - b.after) };
}

export function isEmpty(d: SnapshotDiff): boolean {
  return !d.added.length && !d.removed.length && !d.changed.length && !d.arena.length &&
    !d.reference && !d.craftMatches.length && !d.tiers.length;
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
      if (a === b) continue;
      const pctChange = a === 0 ? Infinity : (b - a) / a;
      if (Math.abs(pctChange) >= threshold) {
        changed.push({ label: configLabel(next), field, before: a, after: b, pctChange });
      }
    }
  }

  changed.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  const arena: SnapshotDiff["arena"] = [];
  for (const [key, board] of [["arenaWebdev", "WebDev"], ["arena", "Chat"]] as const) {
    const prev = new Map((before[key]?.entries ?? []).map((e) => [e.modelDisplayName, e]));
    const next = new Map((after[key]?.entries ?? []).map((e) => [e.modelDisplayName, e]));
    const delta = {
      board,
      added: [...next.keys()].filter((name) => !prev.has(name)),
      removed: [...prev.keys()].filter((name) => !next.has(name)),
      // Include votes: zero -> voted can turn a prior into a ranking input.
      changed: [...next].filter(([name, entry]) => prev.has(name) &&
        JSON.stringify(prev.get(name)) !== JSON.stringify(entry)).map(([name]) => name),
    };
    if (delta.added.length || delta.removed.length || delta.changed.length) arena.push(delta);
  }

  const previousRanking = computeRanking(before);
  const nextRanking = computeRanking(after);
  const reference = previousRanking.referenceElo === nextRanking.referenceElo ? null : {
    before: previousRanking.referenceElo, after: nextRanking.referenceElo,
  };
  const provenance = (row: (typeof previousRanking.all)[number]) =>
    row.craftMatch.kind === "none" ? "unrated" : `${row.craftMatch.kind}: ${row.craftMatch.entry.modelDisplayName}`;
  const previousRows = new Map(previousRanking.all.map((row) => [row.config.config, row]));
  const craftMatches = nextRanking.all.flatMap((row) => {
    const previous = previousRows.get(row.config.config);
    return previous && provenance(previous) !== provenance(row)
      ? [{ label: row.label, before: provenance(previous), after: provenance(row) }] : [];
  });
  const tiers: SnapshotDiff["tiers"] = [];
  for (const tier of TIER_PRESETS) {
    const settings = { ...DEFAULT_SETTINGS, shipFloor: tier.shipFloor, craftFloor: tier.craftFloor };
    const a = computeRanking(before, settings);
    const b = computeRanking(after, settings);
    const oldLabels = new Set(a.qualified.map((row) => row.label));
    const newLabels = new Set(b.qualified.map((row) => row.label));
    const entered = [...newLabels].filter((label) => !oldLabels.has(label));
    const left = [...oldLabels].filter((label) => !newLabels.has(label));
    const beforeWinner = a.qualified[0]?.label ?? null;
    const afterWinner = b.qualified[0]?.label ?? null;
    if (beforeWinner !== afterWinner || entered.length || left.length) {
      tiers.push({ label: tier.label, beforeWinner, afterWinner,
        beforeCount: a.qualified.length, afterCount: b.qualified.length, entered, left });
    }
  }
  return { added, removed, changed, arena, reference, craftMatches, tiers };
}

export function formatDiff(d: SnapshotDiff): string {
  if (isEmpty(d)) return "No changes.";
  const lines: string[] = [];
  for (const tier of d.tiers) {
    lines.push(`  WINNER ${tier.label}: ${tier.beforeWinner ?? "none"} -> ${tier.afterWinner ?? "none"}`);
    lines.push(`    Qualifiers: ${tier.beforeCount} -> ${tier.afterCount}`);
    if (tier.entered.length) lines.push(`    Entered: ${tier.entered.join(", ")}`);
    if (tier.left.length) lines.push(`    Left: ${tier.left.join(", ")}`);
  }
  for (const board of d.arena) {
    for (const name of board.added) lines.push(`  + ${board.board} ENTRY ${name}`);
    for (const name of board.removed) lines.push(`  - ${board.board} ENTRY ${name}`);
    if (board.changed.length) lines.push(`  ~ ${board.board}: ${board.changed.length} existing entries updated (ratings, votes or metadata)`);
  }
  if (d.reference) lines.push(`  ~ Craft reference: ${fmt(d.reference.before)} -> ${fmt(d.reference.after)} Elo`);
  for (const match of d.craftMatches) lines.push(`  ~ ${match.label}: ${match.before} -> ${match.after}`);
  for (const label of d.added) lines.push(`  + NEW CONFIG  ${label}`);
  for (const label of d.removed) lines.push(`  - REMOVED     ${label}`);
  for (const c of d.changed) {
    const arrow = c.pctChange > 0 ? "up" : "down";
    const movement = Number.isFinite(c.pctChange)
      ? `${arrow} ${(Math.abs(c.pctChange) * 100).toFixed(1)}%` : "from zero";
    lines.push(
      `  ~ ${c.label.padEnd(28)} ${c.field.padEnd(17)} ${fmt(c.before)} -> ${fmt(c.after)}  (${movement})`,
    );
  }
  return lines.join("\n");
}

function fmt(n: number): string {
  if (n < 1) return n.toFixed(4);
  if (n < 1000) return n.toFixed(2);
  return Math.round(n).toLocaleString();
}
