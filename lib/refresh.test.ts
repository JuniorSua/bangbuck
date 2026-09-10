import { describe, expect, it } from "vitest";
import previous from "./fixtures/2026-09-05.json";
import astraRating from "./fixtures/astra-webdev.json";
import current from "../data/snapshot.json";
import { diffSnapshots, formatDiff, isEmpty, snapshotUpdate } from "./diff";
import { bbAtFloorCraft, categoryWinners, computeRanking, craftFloorRegimes, DEFAULT_SETTINGS, TIER_PRESETS } from "./score";
import type { Snapshot } from "./types";

const before = previous as Snapshot;
const after: Snapshot = {
  ...before, capturedAt: "2026-09-10T15:30:26.478Z",
  arenaWebdev: { ...before.arenaWebdev!, entries: [...before.arenaWebdev!.entries, astraRating] },
};
const everyday = { ...DEFAULT_SETTINGS, shipFloor: 0.65, craftFloor: 0.7 };

describe("Arena-only refresh regression", () => {
  it("detects both winner changes with identical DeepSWE measurements", () => {
    const diff = diffSnapshots(before, after);
    expect(diff.changed).toEqual([]);
    expect(isEmpty(diff)).toBe(false);
    expect(diff.tiers.map((tier) => [tier.beforeWinner, tier.afterWinner])).toEqual([
      ["claude-opus-5 [high]", "gpt-6-astra [medium]"],
      ["gpt-5.6-sol [high]", "gpt-6-astra [low]"],
    ]);
    expect(diff.tiers.map((tier) => tier.entered.length)).toEqual([4, 5]);
    expect(diff.craftMatches).toHaveLength(5);
    expect(formatDiff(diff)).toContain("WebDev ENTRY gpt-6-astra-max");
    expect(formatDiff(diff)).toContain("claude-opus-5 [high] -> gpt-6-astra [medium]");
    expect(snapshotUpdate(before, after).capturedAt).toBe(after.capturedAt);
  });

  it("detects voting eligibility even when the listed Elo does not change", () => {
    const prior = structuredClone(after);
    prior.arenaWebdev!.entries.at(-1)!.votes = 0;
    const diff = diffSnapshots(prior, after);
    expect(diff.arena[0].changed).toContain("gpt-6-astra-max");
    expect(diff.craftMatches).toHaveLength(5);
    expect(diff.tiers).toHaveLength(2);
  });

  it("reports removal of a load-bearing rating", () => {
    const diff = diffSnapshots(after, before);
    expect(diff.arena[0].removed).toContain("gpt-6-astra-max");
    expect(diff.tiers[0].afterWinner).toBe("claude-opus-5 [high]");
    expect(diff.craftMatches.every((match) => match.after === "unrated")).toBe(true);
  });

  it("ignores capture-time-only changes", () => {
    expect(isEmpty(diffSnapshots(before, { ...before, capturedAt: after.capturedAt }))).toBe(true);
  });

  it("detects a zero-to-nonzero measured field", () => {
    const zero = structuredClone(before);
    zero.deepswe.configs[0].passAt1 = 0;
    const diff = diffSnapshots(zero, before);
    expect(diff.changed.some((change) => change.field === "passAt1" && change.before === 0)).toBe(true);
    expect(formatDiff(diff)).toContain("from zero");
  });
});

describe("new recommendations retain their evidence limits", () => {
  it.each([
    [DEFAULT_SETTINGS, "gpt-6-astra [medium]"],
    [everyday, "gpt-6-astra [low]"],
  ] as const)("inherits the winner's Craft from max effort", (settings, label) => {
    const winner = computeRanking(after, settings).qualified[0];
    expect(winner.label).toBe(label);
    expect(winner.craftMatch.kind).toBe("family");
    if (winner.craftMatch.kind === "family") {
      expect(winner.craftMatch.borrowedFrom).toBe("max");
      expect(winner.craftMatch.entry.votes).toBe(1810);
    }
  });

  // Both winners borrow [max]'s rating across 3-4 effort steps. Families with
  // several rated efforts drift 8.4-23.3 Elo per step (median 20.4), so price
  // that in: lower efforts rated at max minus drift x steps. The crowns hold at
  // 40/step — nearly double the steepest drift observed — and only flip near 60.
  it.each([
    [20.4, "gpt-6-astra [medium]", "gpt-6-astra [low]"],
    [40, "gpt-6-astra [medium]", "gpt-6-astra [low]"],
    [60, "gpt-6-astra [high]", "gpt-5.6-sol [high]"],
  ] as const)("survives %s Elo of effort drift per step", (drift, highPower, everydayWinner) => {
    const drifted = structuredClone(after);
    const steps = { low: 4, medium: 3, high: 2, xhigh: 1 };
    for (const [effort, n] of Object.entries(steps)) {
      drifted.arenaWebdev!.entries.push({
        ...astraRating, modelDisplayName: `gpt-6-astra-${effort}`, rating: astraRating.rating - drift * n,
      });
    }
    expect(computeRanking(drifted, DEFAULT_SETTINGS).qualified[0].label).toBe(highPower);
    expect(computeRanking(drifted, everyday).qualified[0].label).toBe(everydayWinner);
  });

  it("treats equal inherited Craft scores as ties", () => {
    const category = categoryWinners(computeRanking(after, everyday)).find((c) => c.id === "craft")!;
    expect(category.tiedWith).toHaveLength(5);
    expect(category.tiedWith!.every((row) => row.craft === category.winner.craft)).toBe(true);
  });

  it("names the best alternative from a different model on every card but value", () => {
    const cats = categoryWinners(computeRanking(after, DEFAULT_SETTINGS));
    expect(cats.find((c) => c.id === "value")!.alternative).toBeNull();
    for (const c of cats.filter((x) => x.id !== "value")) {
      expect(c.alternative).not.toBeNull();
      expect(c.alternative!.config.config.modelDisplay).not.toBe(c.winner.config.modelDisplay);
      expect(c.alternative!.config.qualified).toBe(true);
    }
    // Astra sweeps cheapest; the next model is the old high-power winner.
    const cheapest = cats.find((c) => c.id === "cheapest")!;
    expect(cheapest.winner.label).toBe("gpt-6-astra [medium]");
    expect(cheapest.alternative!.config.label).toBe("claude-opus-5 [high]");
    expect(cheapest.alternative!.value).toBe("$6.08");
  });

  it("has no alternative when only one model qualifies", () => {
    const solo = computeRanking(after, { ...DEFAULT_SETTINGS, shipFloor: 0.74 });
    expect(new Set(solo.qualified.map((s) => s.config.modelDisplay)).size).toBe(1);
    expect(categoryWinners(solo).every((c) => c.alternative === null)).toBe(true);
  });

  it("cannot promise a crown to an unrated config below the active Ship floor", () => {
    const ranking = computeRanking(before);
    const low = ranking.all.find((row) => row.label === "gpt-6-astra [low]")!;
    expect(bbAtFloorCraft(low, ranking, DEFAULT_SETTINGS)).toBeNull();
    expect(bbAtFloorCraft(low, ranking, everyday)).toBeGreaterThan(0);
  });

  it("does not call a Ship failure a Craft veto when Craft is lowered", () => {
    const ranking = computeRanking(after, { ...DEFAULT_SETTINGS, craftFloor: 0.6 });
    const excluded = ranking.insights!.bestExcludedOnCraft;
    expect(excluded?.label).not.toBe("gpt-5.6-luna [max]");
    if (excluded) expect(excluded.failed).toBe("craft");
  });
});

describe("Craft regime boundaries", () => {
  it.each([DEFAULT_SETTINGS, everyday])("agrees throughout every interval", (settings) => {
    const bands = craftFloorRegimes(after, settings);
    expect(bands.at(-1)!.winner).toBeNull();
    for (const band of bands) {
      for (const craftFloor of [band.from, (band.from + band.to) / 2]) {
        const actual = computeRanking(after, { ...settings, craftFloor });
        expect(actual.qualified[0]?.label).toBe(band.winner?.label);
      }
    }
    expect(bands.find((b) => b.from <= 0.9 && b.to > 0.9)!.winner).toBeNull();
  });

  it("keeps equality qualified, then excludes just above the last Craft score", () => {
    const maxCraft = Math.max(...computeRanking(after).all.map((row) => row.craft ?? 0));
    expect(computeRanking(after, { ...DEFAULT_SETTINGS, craftFloor: maxCraft }).qualified.length).toBeGreaterThan(0);
    expect(computeRanking(after, { ...DEFAULT_SETTINGS, craftFloor: maxCraft + 1e-12 }).qualified).toEqual([]);
  });

  it("represents missing Craft coverage with a no-winner interval", () => {
    expect(craftFloorRegimes({ ...before, arenaWebdev: null }, everyday)).toEqual([
      { from: 0, to: 1, winner: null, qualifiedCount: 0 },
    ]);
  });
});

describe("current snapshot contract — independent of historical winners", () => {
  it.each(TIER_PRESETS)("keeps $label recommendations consistent with their evidence", (tier) => {
    const settings = { ...DEFAULT_SETTINGS, shipFloor: tier.shipFloor, craftFloor: tier.craftFloor };
    const ranking = computeRanking(current as Snapshot, settings);
    expect(ranking.all.length).toBe(current.deepswe.configs.length);
    for (const row of ranking.all) {
      expect(Number.isFinite(row.bb)).toBe(true);
      expect(row.config.ciLo).toBeLessThanOrEqual(row.ship);
      expect(row.config.ciHi).toBeGreaterThanOrEqual(row.ship);
      if (row.qualified) {
        expect(row.ship).toBeGreaterThanOrEqual(settings.shipFloor);
        expect(row.craft).toBeGreaterThanOrEqual(settings.craftFloor);
        expect(row.craftMatch.kind).not.toBe("none");
        if (row.craftMatch.kind !== "none") expect(row.craftMatch.entry.votes).toBeGreaterThan(0);
      }
    }
    expect(ranking.qualified.map((row) => row.bb)).toEqual(
      ranking.qualified.map((row) => row.bb).sort((a, b) => b - a),
    );
  });
});
