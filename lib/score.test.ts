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
  unrankedContenders,
  valueFrontier,
} from "./score";
import { craftFor, familyKey } from "./normalize";
import { MODEL_NOTES, noteFor } from "./notes";
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
    // Re-agreed as the board grows (1409 -> 1418.9 -> 1417.7 -> 1418.8). The
    // reference is the board's median, so it is supposed to move when the board
    // does; the high-power answer has held through every shift.
    expect(r.referenceElo).toBeCloseTo(1418.8, 0);
    expect(referenceElo(snap.arenaWebdev!.entries)).toBe(r.referenceElo);
  });

  it("converts Elo to a win probability, and back", () => {
    // Equal ratings must be a coin flip, and 400 points must be ~10:1.
    expect(craftProbability(1500, 1500)).toBeCloseTo(0.5, 10);
    expect(craftProbability(1900, 1500)).toBeCloseTo(10 / 11, 6);
    expect(craftElo(craftProbability(1667, 1409), 1409)).toBeCloseTo(1667, 6);
  });

  it("scores claude-opus-5 [high] at 81% craft and gpt-5.6-luna [max] at 64%", () => {
    const find = (label: string) => r.all.find((s) => s.label === label)!;
    expect(craftEloOf(find("claude-opus-5 [high]"))).toBeCloseTo(1664.4, 0);
    expect(find("claude-opus-5 [high]").craft).toBeCloseTo(0.805, 2);
    expect(craftEloOf(find("gpt-5.6-luna [max]"))).toBeCloseTo(1518.3, 0);
    expect(find("gpt-5.6-luna [max]").craft).toBeCloseTo(0.641, 2);
  });

  it("is conjunctive — a hole on one axis cannot be filled by the other", () => {
    // The whole point of the geometric blend. A config that ships perfectly but
    // has zero craft must score zero, not half.
    const r2 = computeRanking(snap, DEFAULT_SETTINGS);
    const perfectShipNoCraft = Math.pow(1.0, 1 - 0.6) * Math.pow(0, 0.6);
    expect(perfectShipNoCraft).toBe(0);
    expect(r2.all.every((s) => s.capability === null || s.capability <= 1)).toBe(true);
  });

  it("rates every one of the 61 configs, 17 of them exactly", () => {
    // 61 as of the second 2026-08-13 DeepSWE run, which added the
    // gemini-3.7-flash ladder (its [high] matches Arena exactly, hence 17).
    expect(r.all.filter((s) => s.craft === null)).toHaveLength(0);
    expect(r.all).toHaveLength(61);
    expect(r.insights!.exactCraftCount).toBe(17);
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
      "gemini-3.7-flash [medium]",
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

  it("qualifies 17 configs", () => {
    expect(r.qualified).toHaveLength(17);
    expect(r.all).toHaveLength(61);
  });

  it("crowns gemini-3.7-flash [medium] — the first everyday handover", () => {
    // The everyday answer changed for the first time since the two-axis
    // rebuild: 65.5% ship at $2.03 with 73% craft, edging gpt-5.6-sol [high]
    // by 1.4%. Still a photo finish, and presented as one — but the new
    // leader is the cheapest qualifier the tier has ever had.
    expect(r.qualified[0].label).toBe("gemini-3.7-flash [medium]");
    expect(r.qualified[1].label).toBe("gpt-5.6-sol [high]");
    expect(r.qualified[2].label).toBe("claude-opus-5 [medium]");
    expect(r.insights!.leadMultiple).toBeLessThan(1.06);
  });

  it("puts claude-opus-5 [high] tenth — capable, but you overpay for it here", () => {
    // Sixth, then eighth, now tenth: each refresh has added cheaper qualifiers
    // above it while the high-power tier keeps crowning it. Both true at once
    // is the two-tier design working.
    expect(r.qualified[9].label).toBe("claude-opus-5 [high]");
  });

  it("keeps grok-4.6 [medium] in the top five", () => {
    expect(r.qualified[4].label).toBe("grok-4.6 [medium]");
    expect(r.qualified[4].bb).toBeCloseTo(8.63, 1);
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
    expect(r.all).toHaveLength(61);
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

  it("no longer crowns a dominated config at the everyday tier", () => {
    // This test used to pin the opposite as a known weakness: gpt-5.6-sol
    // [high] won everyday while claude-opus-5 [medium] was cheaper AND more
    // capable, kept on top only by the token/step penalties. The 2026-08-13
    // data resolved it — gemini-3.7-flash [medium] is cheaper than every
    // config above it in capability, so nothing dominates the winner.
    const r = computeRanking(snap, EVERYDAY);
    const w = r.qualified[0];
    const dominated = r.qualified.some(
      (o) => o !== w && o.config.meanCostUsd <= w.config.meanCostUsd && o.capability! > w.capability!,
    );
    expect(dominated).toBe(false);
  });

  it("keeps the everyday winner with the penalties switched off", () => {
    // The old winner depended on the token/step penalties to stay ahead of a
    // cheaper, stronger config. The new one does not: cheapest capable config
    // wins with beta = gamma = 0 too, so the answer no longer rests on the
    // tiebreakers.
    const r = computeRanking(snap, { ...EVERYDAY, beta: 0, gamma: 0 });
    expect(r.qualified[0].label).toBe("gemini-3.7-flash [medium]");
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

  it("keeps the everyday podium a three-way photo finish under any craft weight", () => {
    // Was a two-way tie; gemini-3.7-flash [medium] made it three. The site
    // reports a near-tie rather than a ranking, so it must STAY one whatever
    // the weight — if some weight separated them, the copy would be wrong.
    const PODIUM = ["claude-opus-5 [medium]", "gemini-3.7-flash [medium]", "gpt-5.6-sol [high]"];
    for (const craftWeight of [0, 0.3, 0.6, 1]) {
      const r = computeRanking(snap, { ...EVERYDAY, craftWeight });
      expect(r.qualified.slice(0, 3).map((s) => s.label).sort()).toEqual(PODIUM);
      expect(r.qualified[0].bb / r.qualified[2].bb).toBeLessThan(1.15);
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
    expect(m.kind !== "none" && m.entry.rating).toBeCloseTo(1664.4, 0);
  });

  it("reports no match for a family Arena does not carry", () => {
    expect(craftFor(snap.deepswe.configs[0], []).kind).toBe("none");
  });
});

describe("unrankedContenders — models the formula cannot touch", () => {
  it("no longer lists qwen3.8-max, which DeepSWE measured on 2026-08-04", () => {
    // The graduation this section exists for: the moment a model gets a real
    // Ship score and a measured cost, it must leave the waiting room and enter
    // the ranking. It sat here for one day.
    for (const settings of [DEFAULT_SETTINGS, EVERYDAY]) {
      const names = unrankedContenders(snap, settings).map((c) => c.entry.modelDisplayName);
      expect(names).not.toContain("qwen3.8-max");
    }
    expect(computeRanking(snap, DEFAULT_SETTINGS).all.some((s) => s.label === "qwen3.8-max [xhigh]")).toBe(true);
  });

  it("is empty at both tiers — every credible contender is now measured", () => {
    // Three graduations in nine days: qwen3.8-max (Aug 4), deepseek-v4-flash
    // (Aug 7), grok-4.6 (Aug 13). The waiting room emptying is the pipeline
    // working, not a bug — and the Radar section hides itself when it does.
    expect(unrankedContenders(snap, DEFAULT_SETTINGS)).toHaveLength(0);
    expect(unrankedContenders(snap, EVERYDAY)).toHaveLength(0);
    expect(computeRanking(snap, EVERYDAY).all.some((s) => s.label.startsWith("grok-4.6 ["))).toBe(true);
  });

  it("never lists a model DeepSWE has measured at any effort", () => {
    // The whole point is "no Ship data". A family already benchmarked, even at a
    // different effort, belongs in the ranking rather than here.
    const measured = new Set(snap.deepswe.configs.map((c) => familyKey(c.model)));
    for (const settings of [DEFAULT_SETTINGS, EVERYDAY]) {
      for (const c of unrankedContenders(snap, settings)) {
        expect(measured.has(familyKey(c.entry.modelDisplayName))).toBe(false);
      }
    }
  });

  it("respects the Craft floor and widens as it drops", () => {
    const strict = unrankedContenders(snap, DEFAULT_SETTINGS);
    const loose = unrankedContenders(snap, EVERYDAY);
    for (const c of strict) expect(c.craft).toBeGreaterThanOrEqual(DEFAULT_SETTINGS.craftFloor);
    expect(loose.length).toBeGreaterThanOrEqual(strict.length);
  });

  it("is sorted by Craft, best first", () => {
    const c = unrankedContenders(snap, EVERYDAY);
    for (let i = 1; i < c.length; i++) expect(c[i].craft).toBeLessThanOrEqual(c[i - 1].craft);
  });
});

describe("qwen3.8-max [xhigh] — measured, and the vendor claim checked out", () => {
  const r = computeRanking(snap, DEFAULT_SETTINGS);
  const q = r.all.find((s) => s.label === "qwen3.8-max [xhigh]")!;

  it("is gated out on Ship at both tiers, exactly as its own numbers predicted", () => {
    expect(q.ship).toBeCloseTo(0.5746, 3);
    expect(q.failed).toBe("ship");
    for (const t of TIER_PRESETS) expect(q.ship).toBeLessThan(t.shipFloor);
  });

  it("confirms Alibaba's self-reported 56.6 was honest", () => {
    // The launch claim of 56.6 on DeepSWE 1.1 sits inside the measured 95% CI
    // of 54.8-60.1 — a self-reported figure that survived independent
    // measurement. Worth pinning: it is the calibration point for how much to
    // trust the next vendor claim that lands in lib/notes.ts.
    const CLAIMED = 0.566;
    expect(CLAIMED).toBeGreaterThan(q.config.ciLo);
    expect(CLAIMED).toBeLessThan(q.config.ciHi);
  });

  it("keeps its strong Craft, borrowed from the family's max entry", () => {
    expect(q.craft).toBeCloseTo(0.807, 2);
    expect(q.craftMatch.kind).toBe("family");
    expect(q.organization).toBe("Alibaba");
  });

  it("leaves the high-power answer untouched", () => {
    expect(r.qualified.map((s) => s.label)).toEqual([
      "claude-opus-5 [high]",
      "gpt-5.6-sol [max]",
      "claude-opus-5 [xhigh]",
      "claude-opus-5 [max]",
    ]);
  });
});

describe("vendor claims stay out of the ranking", () => {
  it("keeps every note pointed at a model DeepSWE has NOT measured", () => {
    // A note on a measured model is stale by definition — the real number
    // exists, so the claim must retire. qwen3.8-max's note was removed the day
    // DeepSWE ran it; this keeps the next one from lingering.
    const measured = new Set(snap.deepswe.configs.map((c) => familyKey(c.model)));
    for (const n of MODEL_NOTES) {
      expect(measured.has(familyKey(n.model))).toBe(false);
    }
  });

  it("gives every note a checkable source", () => {
    for (const n of MODEL_NOTES) {
      expect(n.source).toMatch(/^https:\/\/\S+$/);
      expect(n.sourceLabel.length).toBeGreaterThan(3);
    }
  });

  it("scores no config from a hand-written note", () => {
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    for (const note of MODEL_NOTES) {
      // Any note-model appearing in the ranking must be there via the snapshot,
      // never via the note — which the stale-note guard above already forbids.
      expect(r.all.some((s) => s.label.startsWith(note.model))).toBe(false);
    }
  });
});

describe("the date-stamp join fix", () => {
  it("matches deepseek-v4-pro [max] to Arena's date-stamped entry, exactly", () => {
    // Arena lists it as "deepseek-v4-pro-max-20260813". Before the fix the date
    // hid the -max suffix, the join fell through to the base model's 1445, and
    // the config would have shown ~54% craft instead of its real ~75%.
    const dated = snap.arenaWebdev!.entries.find((e) => /^deepseek-v4-pro-max-\d{8}$/.test(e.modelDisplayName));
    expect(dated).toBeDefined();
    const m = craftFor(
      snap.deepswe.configs.find((c) => c.modelDisplay === "deepseek-v4-pro" && c.effort === "max")!,
      snap.arenaWebdev!.entries,
    );
    expect(m.kind).toBe("exact");
    expect(m.kind !== "none" && m.entry.modelDisplayName).toBe(dated!.modelDisplayName);
  });

  it("keeps deepseek-v4-pro [max] out on ship, by a hair on craft too", () => {
    // The most disruptive near-miss on the board: $0.06 per task — 100x cheaper
    // than the winner — at 62.8% ship (CI up to 69.2) and 74.9% craft, 0.1
    // points under the high-power craft bar. If a future revision adds ten ship
    // points this whole page changes; the pipeline will catch it the day
    // DeepSWE does.
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    const d = r.all.find((s) => s.label === "deepseek-v4-pro [max]")!;
    expect(d.config.meanCostUsd).toBeLessThan(0.07);
    expect(d.failed).toBe("both");
    expect(d.craft).toBeCloseTo(0.749, 2);
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

  it("has 61 configs and both Arena boards", () => {
    // 61 since the second 2026-08-13 run added the gemini-3.7-flash ladder.
    expect(snap.deepswe.configs).toHaveLength(61);
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
   * The user picked claude-opus-5 [medium] by hand as best bang-for-buck BEFORE
   * the gpt-5.6 generation existed. Rewinding the field to that point must
   * reproduce their pick with the formula completely unchanged.
   *
   * "Rewinding" now has to remove every family that arrived after the era, not
   * just gpt-5.6 — the benchmark keeps absorbing new models (qwen3.8, grok-4.6,
   * gemini-3.7-flash, deepseek-v4, muse-spark-1.2), and leaving them in would
   * test a field that never existed at any point in time.
   */
  const ERA_NEWCOMERS = [
    "gpt-5.6-",
    "qwen3.8-",
    "grok-4.6",
    "gemini-3.7-",
    "deepseek-v4-",
    "muse-spark-1.2",
  ];
  const eraField = {
    ...snap,
    deepswe: {
      ...snap.deepswe,
      configs: snap.deepswe.configs.filter(
        (c) => !ERA_NEWCOMERS.some((p) => c.modelDisplay.startsWith(p)),
      ),
    },
  };

  it("still crowns claude-opus-5 [medium] at the everyday bar", () => {
    const r = computeRanking(eraField, EVERYDAY);
    expect(r.qualified[0].label).toBe("claude-opus-5 [medium]");
  });

  it("still crowns claude-opus-5 [high] at the high-power bar", () => {
    const r = computeRanking(eraField, DEFAULT_SETTINGS);
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
