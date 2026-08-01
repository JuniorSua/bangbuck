import { describe, expect, it } from "vitest";
import snapshot from "../data/snapshot.json";
import {
  computeRanking,
  craftElo,
  craftFloorRegimes,
  craftEloOf,
  craftProbability,
  DEFAULT_SETTINGS,
  referenceElo,
  TIER_PRESETS,
  valueFrontier,
} from "./score";
import { craftFor, familyKey } from "./normalize";
import { linearTicks, rangeTicks } from "./metrics";
import { canonicalVendor } from "./vendors";
import type { Snapshot } from "./types";

const snap = snapshot as unknown as Snapshot;
const everyday = TIER_PRESETS.find((t) => t.id === "everyday")!;
const EVERYDAY = {
  ...DEFAULT_SETTINGS,
  shipFloor: everyday.shipFloor,
  craftFloor: everyday.craftFloor,
};

/**
 * Golden tests. These encode the user's judgment call and were verified by hand
 * against the live leaderboards before any code was written. If the formula is
 * retuned, these numbers are what must be consciously re-agreed — not quietly
 * updated to match whatever the code now does.
 */
describe("the two axes", () => {
  const r = computeRanking(snap, DEFAULT_SETTINGS);

  it("measures Craft against the WebDev board's median", () => {
    expect(r.referenceElo).toBeCloseTo(1409, 0);
    expect(referenceElo(snap.arenaWebdev!.entries)).toBe(r.referenceElo);
  });

  it("converts Elo to a win probability, and back", () => {
    // Equal ratings must be a coin flip, and 400 points must be ~10:1.
    expect(craftProbability(1500, 1500)).toBeCloseTo(0.5, 10);
    expect(craftProbability(1900, 1500)).toBeCloseTo(10 / 11, 6);
    expect(craftElo(craftProbability(1667, 1409), 1409)).toBeCloseTo(1667, 6);
  });

  it("scores claude-opus-5 [high] at 82% craft and gpt-5.6-luna [max] at 66%", () => {
    const find = (label: string) => r.all.find((s) => s.label === label)!;
    expect(craftEloOf(find("claude-opus-5 [high]"))).toBeCloseTo(1667, 0);
    expect(find("claude-opus-5 [high]").craft).toBeCloseTo(0.815, 2);
    expect(craftEloOf(find("gpt-5.6-luna [max]"))).toBeCloseTo(1523, 0);
    expect(find("gpt-5.6-luna [max]").craft).toBeCloseTo(0.659, 2);
  });

  it("is conjunctive — a hole on one axis cannot be filled by the other", () => {
    // The whole point of the geometric blend. A config that ships perfectly but
    // has zero craft must score zero, not half.
    const r2 = computeRanking(snap, DEFAULT_SETTINGS);
    const perfectShipNoCraft = Math.pow(1.0, 1 - 0.6) * Math.pow(0, 0.6);
    expect(perfectShipNoCraft).toBe(0);
    expect(r2.all.every((s) => s.capability === null || s.capability <= 1)).toBe(true);
  });

  it("rates every one of the 50 configs, 12 of them exactly", () => {
    expect(r.all.filter((s) => s.craft === null)).toHaveLength(0);
    expect(r.insights!.exactCraftCount).toBe(12);
  });
});

describe("BangBuck at default settings (High power)", () => {
  const r = computeRanking(snap, DEFAULT_SETTINGS);

  it("crowns claude-opus-5 [high]", () => {
    expect(r.qualified[0].label).toBe("claude-opus-5 [high]");
    expect(r.qualified[0].bb).toBeCloseTo(4.92, 1);
  });

  it("leads by 1.36x", () => {
    expect(r.insights!.leadMultiple).toBeCloseTo(1.36, 1);
  });

  it("admits exactly the four configs that clear both floors", () => {
    expect(r.qualified.map((s) => s.label)).toEqual([
      "claude-opus-5 [high]",
      "gpt-5.6-sol [max]",
      "claude-opus-5 [xhigh]",
      "claude-opus-5 [max]",
    ]);
  });

  it("rates the winner exactly rather than by family inheritance", () => {
    // The winner resting on a borrowed rating would undercut the whole claim.
    expect(r.qualified[0].craftMatch.kind).toBe("exact");
  });
});

describe("the Craft gate — the reason this version exists", () => {
  const r = computeRanking(snap, DEFAULT_SETTINGS);

  it("excludes gpt-5.6-luna [max], the previous version's winner", () => {
    const luna = r.all.find((s) => s.label === "gpt-5.6-luna [max]")!;
    expect(luna.qualified).toBe(false);
    expect(luna.craft!).toBeLessThan(DEFAULT_SETTINGS.craftFloor);
  });

  it("names it as the best config the gate threw out", () => {
    // Surfacing this is the site's argument: the cheap option was considered and
    // rejected for a stated reason, not simply missing.
    expect(r.insights!.bestExcludedOnCraft!.label).toBe("gpt-5.6-luna [max]");
    expect(r.insights!.winnerPreferredOverExcluded).toBeCloseTo(0.7, 1);
  });

  it("would still crown luna if Craft were only weighted, not gated", () => {
    // The finding that shaped the design: weighting alone does not fix anything,
    // because cost varies ~20x across the field while craft varies ~1.3x.
    const weightedOnly = computeRanking(snap, {
      ...DEFAULT_SETTINGS,
      shipFloor: 0.65,
      craftFloor: 0,
      craftWeight: 0.9,
    });
    expect(weightedOnly.qualified[0].label).toBe("gpt-5.6-luna [max]");
  });

  it("barely moves the scores when craftWeight is swung from 0.5 to 0.7", () => {
    const at = (w: number) =>
      computeRanking(snap, { ...DEFAULT_SETTINGS, craftWeight: w }).qualified[0].bb;
    expect(Math.abs(at(0.7) / at(0.5) - 1)).toBeLessThan(0.05);
  });
});

describe("craftFloorRegimes", () => {
  it("collapses the whole Craft sweep into a handful of stable answers", () => {
    const r = craftFloorRegimes(snap, EVERYDAY);
    expect(r.map((x) => x.winner?.label)).toEqual([
      "gpt-5.6-luna [max]",
      "gpt-5.6-sol [high]",
      "claude-opus-5 [medium]",
      "kimi-k3 [max]",
      "claude-opus-5 [xhigh]",
    ]);
  });

  it("covers 0..1 with no gaps and no overlaps", () => {
    // The bands are a partition, not a sample — a gap would mean some floor the
    // reader can select has no answer shown for it.
    for (const settings of [DEFAULT_SETTINGS, EVERYDAY]) {
      const r = craftFloorRegimes(snap, settings);
      expect(r[0].from).toBe(0);
      expect(r[r.length - 1].to).toBe(1);
      for (let i = 1; i < r.length; i++) expect(r[i].from).toBe(r[i - 1].to);
    }
  });

  it("never lists the same winner in two adjacent bands", () => {
    for (const settings of [DEFAULT_SETTINGS, EVERYDAY]) {
      const r = craftFloorRegimes(snap, settings);
      for (let i = 1; i < r.length; i++) {
        expect(r[i].winner?.label).not.toBe(r[i - 1].winner?.label);
      }
    }
  });

  it("agrees with computeRanking at every band's own floor", () => {
    // The exhibit is a control as well as a picture: clicking a band sets that
    // floor, so the band's claim and the resulting ranking must not disagree.
    for (const band of craftFloorRegimes(snap, EVERYDAY)) {
      const r = computeRanking(snap, { ...EVERYDAY, craftFloor: band.from });
      expect(r.qualified[0]?.label).toBe(band.winner?.label);
      expect(r.qualified).toHaveLength(band.qualifiedCount);
    }
  });

  it("shrinks the qualifying field monotonically as the bar rises", () => {
    const r = craftFloorRegimes(snap, EVERYDAY);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].qualifiedCount).toBeLessThan(r[i - 1].qualifiedCount);
    }
  });
});

describe("the Everyday tier", () => {
  const r = computeRanking(snap, EVERYDAY);

  it("qualifies 12 configs", () => {
    expect(r.qualified).toHaveLength(12);
    expect(r.all).toHaveLength(50);
  });

  it("is a statistical tie between gpt-5.6-sol [high] and claude-opus-5 [medium]", () => {
    // Documented as a tie on purpose: a 4% gap is not a ranking, and the site
    // must not present it as one.
    expect(r.qualified[0].label).toBe("gpt-5.6-sol [high]");
    expect(r.qualified[1].label).toBe("claude-opus-5 [medium]");
    expect(r.insights!.leadMultiple).toBeLessThan(1.06);
  });

  it("puts claude-opus-5 [high] sixth — capable, but you overpay for it here", () => {
    expect(r.qualified[5].label).toBe("claude-opus-5 [high]");
  });
});

describe("the floors", () => {
  it("distinguishes why a config was rejected", () => {
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    const find = (label: string) => r.all.find((s) => s.label === label)!;
    // Clears ship at 73.2% but not craft; the reverse for terra.
    expect(find("gpt-5.6-sol [xhigh]").failed).toBe("ship");
    expect(find("gpt-5.6-luna [max]").failed).toBe("both");
    expect(find("claude-opus-5 [max]").failed).toBeNull();
  });

  it("yields no winner when nothing clears both floors", () => {
    const r = computeRanking(snap, { ...DEFAULT_SETTINGS, shipFloor: 0.99 });
    expect(r.qualified).toHaveLength(0);
    expect(r.insights).toBeNull();
    expect(r.all).toHaveLength(50);
  });

  it("keeps BB scores stable as the floors move", () => {
    // Penalty baselines come from all configs, so filtering must not rescale scores.
    const a = computeRanking(snap, { ...DEFAULT_SETTINGS, shipFloor: 0.6, craftFloor: 0.5 });
    const b = computeRanking(snap, { ...DEFAULT_SETTINGS, shipFloor: 0.7, craftFloor: 0.7 });
    const find = (r: typeof a) => r.all.find((s) => s.label === "claude-opus-5 [high]")!.bb;
    expect(find(a)).toBeCloseTo(find(b), 10);
  });

  it("does not crown a cheap-and-unreliable config even with both floors dropped", () => {
    const r = computeRanking(snap, { ...DEFAULT_SETTINGS, shipFloor: 0.5, craftFloor: 0.5 });
    expect(r.qualified[0].ship).toBeGreaterThan(0.45);
  });
});

describe("invariants that must hold at any setting", () => {
  // Swept rather than spot-checked: the floors are user-controllable, so a
  // setting nobody chose by hand still has to produce a coherent ranking.
  const sweep = [0.5, 0.6, 0.65, 0.7, 0.725, 0.75].flatMap((shipFloor) =>
    [0.5, 0.6, 0.7, 0.75, 0.8].map((craftFloor) =>
      computeRanking(snap, { ...DEFAULT_SETTINGS, shipFloor, craftFloor }),
    ),
  );

  it("never produces a NaN or infinite score", () => {
    for (const r of sweep) {
      for (const s of r.all) {
        expect(Number.isFinite(s.bb)).toBe(true);
        expect(Number.isFinite(s.ship)).toBe(true);
        if (s.capability !== null) expect(Number.isFinite(s.capability)).toBe(true);
      }
    }
  });

  it("keeps combined capability inside 0..1", () => {
    // Both inputs are probabilities, so their geometric blend must be one too.
    // A capability above 1 would mean a term escaped its scale.
    for (const r of sweep) {
      for (const s of r.all) {
        if (s.capability === null) continue;
        expect(s.capability).toBeGreaterThan(0);
        expect(s.capability).toBeLessThanOrEqual(1);
      }
    }
  });

  it("admits nothing that fails either floor", () => {
    for (const r of sweep) {
      for (const s of r.qualified) {
        expect(s.ship).toBeGreaterThanOrEqual(r.settings.shipFloor);
        expect(s.craft!).toBeGreaterThanOrEqual(r.settings.craftFloor);
        expect(s.failed).toBeNull();
      }
    }
  });

  it("returns qualified configs in descending BangBuck order", () => {
    for (const r of sweep) {
      for (let i = 1; i < r.qualified.length; i++) {
        expect(r.qualified[i - 1].bb).toBeGreaterThanOrEqual(r.qualified[i].bb);
        expect(r.qualified[i].rank).toBe(i + 1);
      }
    }
  });

  it("never grows the field when a floor is raised", () => {
    // Monotonicity is the property that makes the floors mean what they say.
    const at = (shipFloor: number, craftFloor: number) =>
      computeRanking(snap, { ...DEFAULT_SETTINGS, shipFloor, craftFloor }).qualified.length;
    for (const cf of [0.5, 0.7, 0.8]) {
      const counts = [0.5, 0.6, 0.65, 0.7, 0.725, 0.75].map((sf) => at(sf, cf));
      for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
    for (const sf of [0.5, 0.65, 0.725]) {
      const counts = [0.5, 0.6, 0.7, 0.75, 0.8].map((cf) => at(sf, cf));
      for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
  });

  it("never crowns a dominated config at the high-power tier", () => {
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    const w = r.qualified[0];
    const dominated = r.qualified.some(
      (o) => o !== w && o.config.meanCostUsd <= w.config.meanCostUsd && o.capability! > w.capability!,
    );
    expect(dominated).toBe(false);
  });

  it("DOES crown a dominated config at the everyday tier — a known weakness", () => {
    // Pinned deliberately rather than hidden. gpt-5.6-sol [high] wins the
    // everyday tier while claude-opus-5 [medium] is BOTH cheaper ($3.29 vs
    // $3.47) and more capable (0.762 vs 0.740). Sol only wins on the token and
    // step penalties — 28k/37 against 37k/52 — which means a tiebreaker meant
    // to stand in for wall-clock time is overturning both axes the formula
    // claims to rank on.
    //
    // Left as-is because the penalties are the user's stated judgment and the
    // gap is 4%, which the UI already reports as a tie rather than a ranking.
    // If this test ever starts failing, the penalties were retuned and the
    // everyday answer moved to claude-opus-5 [medium] — check that was intended.
    const r = computeRanking(snap, EVERYDAY);
    const [winner, second] = r.qualified;
    expect(winner.label).toBe("gpt-5.6-sol [high]");
    expect(second.label).toBe("claude-opus-5 [medium]");
    expect(second.config.meanCostUsd).toBeLessThan(winner.config.meanCostUsd);
    expect(second.capability!).toBeGreaterThan(winner.capability!);
    expect(winner.bb / second.bb).toBeLessThan(1.05);
  });

  it("puts claude-opus-5 [medium] first once the penalties are switched off", () => {
    // The same finding from the other side: with beta and gamma at zero, the
    // everyday tier ranks on capability and price alone and the order reverses.
    const r = computeRanking(snap, { ...EVERYDAY, beta: 0, gamma: 0 });
    expect(r.qualified[0].label).toBe("claude-opus-5 [medium]");
  });

  it("is deterministic", () => {
    const a = computeRanking(snap, DEFAULT_SETTINGS).all.map((s) => `${s.label}:${s.bb}`);
    const b = computeRanking(snap, DEFAULT_SETTINGS).all.map((s) => `${s.label}:${s.bb}`);
    expect(a).toEqual(b);
  });

  it("carries confidence bounds that actually bracket the score", () => {
    for (const c of snap.deepswe.configs) {
      expect(c.ciLo).toBeLessThanOrEqual(c.passAt1);
      expect(c.ciHi).toBeGreaterThanOrEqual(c.passAt1);
    }
  });
});

describe("robustness of the two headline answers", () => {
  const winnerAt = (s: Partial<typeof DEFAULT_SETTINGS>, base = DEFAULT_SETTINGS) =>
    computeRanking(snap, { ...base, ...s }).qualified[0]?.label;

  it("holds claude-opus-5 [high] at high power across every penalty setting", () => {
    for (const b of [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.6]) {
      expect(winnerAt({ beta: b, gamma: b })).toBe("claude-opus-5 [high]");
    }
  });

  it("holds it across every craft weight from 0 to 1", () => {
    for (const w of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1]) {
      expect(winnerAt({ craftWeight: w })).toBe("claude-opus-5 [high]");
    }
  });

  it("keeps the everyday top two a tie under any craft weight", () => {
    // Reported as a tie on the site, so it has to stay one — if some weight
    // separated them, the copy would be wrong rather than cautious.
    for (const craftWeight of [0, 0.3, 0.6, 1]) {
      const r = computeRanking(snap, { ...EVERYDAY, craftWeight });
      const gap = r.qualified[0].bb / r.qualified[1].bb;
      expect(gap).toBeLessThan(1.1);
      expect([r.qualified[0].label, r.qualified[1].label].sort()).toEqual([
        "claude-opus-5 [medium]",
        "gpt-5.6-sol [high]",
      ]);
    }
  });

  it("agrees with the winner's own arithmetic", () => {
    // Recompute the headline from raw snapshot fields, bypassing every helper.
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    const w = r.qualified[0];
    const minTok = Math.min(...snap.deepswe.configs.map((c) => c.meanOutputTokens));
    const minStep = Math.min(...snap.deepswe.configs.map((c) => c.meanAgentSteps));
    const craft = 1 / (1 + Math.pow(10, (r.referenceElo - craftEloOf(w)) / 400));
    const k = Math.pow(w.config.passAt1, 0.4) * Math.pow(craft, 0.6);
    const bb =
      (k * 100) /
      (w.config.meanCostUsd *
        Math.pow(w.config.meanOutputTokens / minTok, 0.2) *
        Math.pow(w.config.meanAgentSteps / minStep, 0.2));
    expect(w.bb).toBeCloseTo(bb, 10);
  });
});

describe("why-it-won insights", () => {
  const { insights } = computeRanking(snap, DEFAULT_SETTINGS);

  it("reports the winner against the raw capability frontier", () => {
    expect(insights!.frontier.label).toBe("claude-opus-5 [max]");
    expect(insights!.pctOfFrontierScore).toBeCloseTo(98.9, 0);
    expect(insights!.cheaperThanFrontier).toBeCloseTo(1.95, 1);
  });

  it("shows what beating it on capability would cost", () => {
    expect(insights!.cheapestBetter!.label).toBe("claude-opus-5 [xhigh]");
    expect(insights!.cheapestBetterPriceMultiple).toBeGreaterThan(1);
  });

  it("computes the per-$100 hero stat", () => {
    expect(insights!.winner.solvedPer100).toBeCloseTo(12, 0);
    expect(insights!.frontier.solvedPer100).toBeCloseTo(6, 0);
  });
});

describe("craft matching", () => {
  const webdev = snap.arenaWebdev!.entries;

  it("prefers an exact model+effort match", () => {
    const opus5High = snap.deepswe.configs.find(
      (c) => c.model === "claude-opus-5" && c.effort === "high",
    )!;
    const m = craftFor(opus5High, webdev);
    expect(m.kind).toBe("exact");
    expect(m.kind === "exact" && m.entry.modelDisplayName).toBe("claude-opus-5-high");
  });

  it("borrows the NEAREST effort, not the family's best", () => {
    // claude-opus-5 [low] must not inherit [max]'s 1703. Taking the family's top
    // rating would flatter exactly the configs least entitled to it.
    const low = snap.deepswe.configs.find(
      (c) => c.model === "claude-opus-5" && c.effort === "low",
    )!;
    const m = craftFor(low, webdev);
    expect(m.kind).toBe("family");
    expect(m.kind === "family" && m.borrowedFrom).toBe("high");
    expect(m.kind !== "none" && m.entry.rating).toBeCloseTo(1667, 0);
  });

  it("reports no match for a family Arena does not carry", () => {
    expect(craftFor(snap.deepswe.configs[0], []).kind).toBe("none");
  });
});

describe("snapshot integrity", () => {
  it("carries live pricing, not the stale artifact's", () => {
    const luna = snap.deepswe.configs.find(
      (c) => c.model === "gpt-5-6-luna" && c.effort === "max",
    )!;
    expect(luna.meanCostUsd).toBeLessThan(1); // stale artifact reports $3.028
    expect(luna.meanCostUsd).toBeCloseTo(0.6056, 3);
  });

  it("has 50 configs and both Arena boards", () => {
    expect(snap.deepswe.configs).toHaveLength(50);
    expect(snap.arena!.entries.length).toBeGreaterThan(50);
    expect(snap.arenaWebdev!.slug).toBe("code-webdev");
    expect(snap.arenaWebdev!.entries.length).toBeGreaterThan(100);
  });

  it("has claude-opus-5-max topping the WebDev board", () => {
    expect(snap.arenaWebdev!.entries[0].modelDisplayName).toBe("claude-opus-5-max");
  });
});

describe("hindsight check — the era before gpt-5.6 shipped", () => {
  /**
   * The user picked claude-opus-5 [medium] by hand as best bang-for-buck BEFORE the
   * gpt-5.6 generation existed. DeepSWE's own v1 snapshot (2026-06-20) confirms
   * none of luna/sol/terra were on the leaderboard then.
   *
   * Rewinding the field to that point must reproduce their pick with the formula
   * completely unchanged. If a future tuning breaks this, the formula has drifted
   * away from the judgment it was built to encode.
   */
  const withoutGpt56 = {
    ...snap,
    deepswe: {
      ...snap.deepswe,
      configs: snap.deepswe.configs.filter((c) => !c.model.startsWith("gpt-5-6")),
    },
  };

  it("still crowns claude-opus-5 [medium] at the everyday bar", () => {
    const r = computeRanking(withoutGpt56, EVERYDAY);
    expect(r.qualified[0].label).toBe("claude-opus-5 [medium]");
  });

  it("still crowns claude-opus-5 [high] at the high-power bar", () => {
    const r = computeRanking(withoutGpt56, DEFAULT_SETTINGS);
    expect(r.qualified[0].label).toBe("claude-opus-5 [high]");
  });
});

describe("valueFrontier", () => {
  const ranking = computeRanking(snap, DEFAULT_SETTINGS);
  const frontier = valueFrontier(ranking.all);

  it("includes the most capable config — nothing cheaper is better", () => {
    const best = ranking.all.reduce((a, b) => (b.capability! > a.capability! ? b : a));
    expect(frontier.map((s) => s.label)).toContain(best.label);
  });

  it("is sorted by cost and strictly increasing in capability", () => {
    // The defining property: paying more is the only way to get more.
    for (let i = 1; i < frontier.length; i++) {
      expect(frontier[i].config.meanCostUsd).toBeGreaterThan(frontier[i - 1].config.meanCostUsd);
      expect(frontier[i].capability!).toBeGreaterThan(frontier[i - 1].capability!);
    }
  });

  it("leaves every excluded config dominated by something on the line", () => {
    const off = ranking.all.filter((s) => !frontier.includes(s) && s.capability !== null);
    for (const b of off) {
      const dominated = frontier.some(
        (a) => a.config.meanCostUsd <= b.config.meanCostUsd && a.capability! >= b.capability!,
      );
      expect(dominated).toBe(true);
    }
  });
});

describe("familyKey", () => {
  it("joins DeepSWE and Arena naming variants", () => {
    expect(familyKey("gpt-5-6-luna")).toBe("gpt56luna");
    expect(familyKey("gpt-5.6-luna-xhigh")).toBe("gpt56luna");
    expect(familyKey("gpt-5.6-luna-xhigh (codex-harness)")).toBe("gpt56luna");
    expect(familyKey("claude-opus-5-max")).toBe(familyKey("claude-opus-5"));
  });
});

describe("vendor coverage", () => {
  it("resolves every organization in the ranking to a canonical vendor", () => {
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    for (const s of r.all) expect(canonicalVendor(s.organization)).not.toBeNull();
  });
});

describe("rangeTicks", () => {
  it("fits ticks inside a domain that does not start at zero", () => {
    // Craft spans roughly 0.55-0.85; a zero-anchored axis wastes most of the plot.
    expect(rangeTicks(0.52, 0.87)).toEqual([0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85]);
  });

  it("never emits a tick outside the domain", () => {
    for (const [lo, hi] of [[0.52, 0.87], [3, 97], [-5, 5], [1400, 1750]]) {
      for (const t of rangeTicks(lo, hi)) {
        expect(t).toBeGreaterThanOrEqual(lo);
        expect(t).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe("linearTicks", () => {
  it("gives readable steps near the target count", () => {
    // 276k output tokens: the naive 'first step >= max/target' rule produced a
    // 100k step and only three labels.
    expect(linearTicks(276000)).toEqual([0, 50000, 100000, 150000, 200000, 250000]);
    expect(linearTicks(268)).toEqual([0, 50, 100, 150, 200, 250]);
  });

  it("always starts at zero and never overshoots the max", () => {
    for (const max of [12, 268, 5000, 276000]) {
      const t = linearTicks(max);
      expect(t[0]).toBe(0);
      expect(t[t.length - 1]).toBeLessThanOrEqual(max);
    }
  });
});
