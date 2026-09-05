import { describe, expect, it } from "vitest";
import snapshot from "../data/snapshot.json";
import {
  bbAtFloorCraft,
  categoryWinners,
  computeRanking,
  craftElo,
  craftFloorRegimes,
  craftEloOf,
  craftProbability,
  DEFAULT_SETTINGS,
  referenceElo,
  TIER_PRESETS,
  unrankedContenders,
  unratedMeasured,
  valueFrontier,
} from "./score";
import { craftFor, familyKey, isRated } from "./normalize";
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
    // Re-agreed as the board grows (1409 -> 1418.9 -> 1417.7 -> 1418.8 ->
    // 1434.6). The 2026-09-03 jump of +15.8 is the largest yet: claude-fable-5.1
    // entered at 1763, the strongest WebDev rating ever recorded here, and
    // pulled the median up with it. Craft is RELATIVE, so every config's craft
    // percentage fell without any model getting worse — and gpt-5.6-sol [max]
    // was gated out of high power because of it. See the dedicated test below.
    expect(r.referenceElo).toBeCloseTo(1434.6, 0);
    expect(referenceElo(snap.arenaWebdev!.entries)).toBe(r.referenceElo);
  });

  it("converts Elo to a win probability, and back", () => {
    // Equal ratings must be a coin flip, and 400 points must be ~10:1.
    expect(craftProbability(1500, 1500)).toBeCloseTo(0.5, 10);
    expect(craftProbability(1900, 1500)).toBeCloseTo(10 / 11, 6);
    expect(craftElo(craftProbability(1667, 1409), 1409)).toBeCloseTo(1667, 6);
  });

  it("scores claude-opus-5 [high] at 79% craft and gpt-5.6-luna [max] at 62%", () => {
    // Both Elos essentially unchanged; both craft percentages down ~1.5 points
    // purely because the median rose. This is the relative axis working as
    // designed, and is why these numbers are re-agreed rather than pinned loose.
    const find = (label: string) => r.all.find((s) => s.label === label)!;
    expect(craftEloOf(find("claude-opus-5 [high]"))).toBeCloseTo(1662.3, 0);
    expect(find("claude-opus-5 [high]").craft).toBeCloseTo(0.788, 2);
    expect(craftEloOf(find("gpt-5.6-luna [max]"))).toBeCloseTo(1518.8, 0);
    expect(find("gpt-5.6-luna [max]").craft).toBeCloseTo(0.619, 2);
  });

  it("is conjunctive — a hole on one axis cannot be filled by the other", () => {
    // The whole point of the geometric blend. A config that ships perfectly but
    // has zero craft must score zero, not half.
    const r2 = computeRanking(snap, DEFAULT_SETTINGS);
    const perfectShipNoCraft = Math.pow(1.0, 1 - 0.6) * Math.pow(0, 0.6);
    expect(perfectShipNoCraft).toBe(0);
    expect(r2.all.every((s) => s.capability === null || s.capability <= 1)).toBe(true);
  });

  it("rates 65 of the 70 configs, 18 of them exactly", () => {
    // 70 as of the 2026-09-03 run: the five-config gpt-6-astra ladder plus two
    // gemini-3.8-flash. All five astra configs are UNRATED — Arena carries no
    // gpt-6 entry on either board — which is the largest data gap the site has
    // had, and the reason the "not rankable yet" section now has two halves.
    expect(r.all).toHaveLength(70);
    const unrated = r.all.filter((s) => s.craft === null);
    expect(unrated).toHaveLength(5);
    expect(unrated.every((s) => s.label.startsWith("gpt-6-astra"))).toBe(true);
    expect(r.insights!.exactCraftCount).toBe(18);
  });
});

describe("BangBuck at default settings (High power)", () => {
  const r = computeRanking(snap, DEFAULT_SETTINGS);

  it("crowns claude-opus-5 [high]", () => {
    // BB re-agreed 4.92 -> 3.84 when the penalties rose to 0.25; heavy configs
    // pay more everywhere, so absolute scores compress while the order holds.
    expect(r.qualified[0].label).toBe("claude-opus-5 [high]");
    expect(r.qualified[0].bb).toBeCloseTo(3.84, 1);
  });

  it("leads by 1.68x again, because the runner-up was gated out", () => {
    // Not a widening on merit. gpt-5.6-sol [max] held second at 1.03x until the
    // rising median pushed its craft under the floor; with it gone the gap to
    // the next config is structural. High power is now all-Anthropic, which is
    // worth noticing rather than celebrating.
    expect(r.insights!.leadMultiple).toBeCloseTo(1.68, 1);
    expect(r.qualified[1].label).toBe("claude-opus-5 [xhigh]");
  });

  it("admits exactly the three configs that clear both floors", () => {
    expect(r.qualified.map((s) => s.label)).toEqual([
      "claude-opus-5 [high]",
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
    // gemini-3.7-flash [medium] held a band here for the few hours the
    // penalties sat at 0.20; at 0.25 its token weight prices it out of every
    // band and the sweep returns to five stable answers.
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

  it("qualifies 18 configs", () => {
    expect(r.qualified).toHaveLength(18);
    expect(r.all).toHaveLength(70);
  });

  it("crowns gpt-5.6-sol [high] decisively — everyday is no longer a tie", () => {
    // The 2026-08-13 decision, pinned. At beta=gamma=0.20 gemini [medium] took
    // this tier by 1.4% on a $2.03 price while burning 3.3x the tokens, 3.2x
    // the steps and 2.1x the wall-clock of sol — and clearing the ship floor
    // on a CI that straddles it. The owner's criterion is result against cost,
    // tokens and steps TOGETHER, so the penalties rose to 0.25 and the leanest
    // capable config wins with a margin that is not knife-edged. Gemini keeps
    // the podium on price, which is exactly as much as its heaviness earns.
    // The same 23% price cut that squeezed high power blew everyday open: sol
    // [high] fell $3.47 -> $2.66 and its lead went 1.07x -> 1.40x. It is now
    // the cheapest config on the everyday podium AND the leanest, which is the
    // owner's criteria pointing the same way for once.
    expect(r.qualified[0].label).toBe("gpt-5.6-sol [high]");
    expect(r.qualified[1].label).toBe("claude-opus-5 [medium]");
    expect(r.qualified[2].label).toBe("gemini-3.7-flash [medium]");
    expect(r.insights!.leadMultiple).toBeCloseTo(1.40, 1);
  });

  it("keeps claude-opus-5 [high] eleventh — capable, but you overpay for it here", () => {
    // Sixth, eighth, tenth, now eleventh: every refresh adds cheaper qualifiers
    // above it while the high-power tier keeps crowning it. Both true at once
    // is the two-tier design working.
    expect(r.qualified[10].label).toBe("claude-opus-5 [high]");
  });

  it("keeps grok-4.6 [medium] in the top six", () => {
    expect(r.qualified[5].label).toBe("grok-4.6 [medium]");
    expect(r.qualified[5].bb).toBeCloseTo(6.77, 1);
  });
});

describe("the floors", () => {
  it("distinguishes why a config was rejected", () => {
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    const find = (label: string) => r.all.find((s) => s.label === label)!;
    // sol [xhigh] now misses BOTH: 70.7% ship under the 72.5% bar, and its
    // craft slipped under 75% when the median rose.
    expect(find("gpt-5.6-sol [xhigh]").failed).toBe("both");
    expect(find("gpt-5.6-sol [max]").failed).toBe("craft");
    expect(find("gpt-5.6-luna [max]").failed).toBe("both");
    expect(find("claude-opus-5 [max]").failed).toBeNull();
  });

  it("yields no winner when nothing clears both floors", () => {
    const r = computeRanking(snap, { ...DEFAULT_SETTINGS, shipFloor: 0.99 });
    expect(r.qualified).toHaveLength(0);
    expect(r.insights).toBeNull();
    expect(r.all).toHaveLength(70);
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

  it("crowns an everyday winner that is now cheapest AND leanest", () => {
    // This test has tracked an awkward truth twice: the everyday winner used to
    // be dominated on capability-and-price and held its crown only through the
    // penalties. The 2026-08-26 price cut ended that. gpt-5.6-sol [high] is now
    // cheaper than claude-opus-5 [medium] outright, and leaner on both tokens
    // and steps, so nothing about the crown is awkward any more.
    const r = computeRanking(snap, EVERYDAY);
    const w = r.qualified[0];
    const opus = r.qualified.find((s) => s.label === "claude-opus-5 [medium]")!;
    expect(w.config.meanCostUsd).toBeLessThan(opus.config.meanCostUsd);
    expect(w.config.meanOutputTokens).toBeLessThan(opus.config.meanOutputTokens);
    expect(w.config.meanAgentSteps).toBeLessThan(opus.config.meanAgentSteps);
    const dominated = r.qualified.some(
      (o) => o !== w && o.config.meanCostUsd <= w.config.meanCostUsd && o.capability! > w.capability!,
    );
    expect(dominated).toBe(false);
  });

  it("hands the crown to the token-heaviest podium config if the penalties are removed", () => {
    // The counterfactual that justifies the penalties existing: at beta=gamma=0
    // gemini-3.7-flash [medium] wins on price while burning 3.3x the tokens of
    // the actual winner. The penalties are carrying the owner's judgment, and
    // this test is the record of what they are holding back.
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
    // Robust again, but for an uncomfortable reason: the config that took it at
    // 0.40 last refresh, gpt-5.6-sol [max], is no longer in the tier at all.
    // Stability by elimination is not the same as stability on merit.
    for (const b of [0, 0.05, 0.1, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6]) {
      expect(winnerAt({ beta: b, gamma: b })).toBe("claude-opus-5 [high]");
    }
  });

  it("holds it across every craft weight from 0 to 1", () => {
    for (const w of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 1]) {
      expect(winnerAt({ craftWeight: w })).toBe("claude-opus-5 [high]");
    }
  });

  it("holds the everyday podium under any craft weight, no longer a tie", () => {
    // Same three configs at every weight, but the spread widened from under
    // 1.15x to about 1.45x when sol got cheaper. The site drops its "photo
    // finish" wording above 1.05x, so this pins that the copy is right to.
    const PODIUM = ["claude-opus-5 [medium]", "gemini-3.7-flash [medium]", "gpt-5.6-sol [high]"];
    for (const craftWeight of [0, 0.3, 0.6, 1]) {
      const r = computeRanking(snap, { ...EVERYDAY, craftWeight });
      expect(r.qualified.slice(0, 3).map((s) => s.label).sort()).toEqual(PODIUM);
      expect(r.qualified[0].label).toBe("gpt-5.6-sol [high]");
      expect(r.qualified[0].bb / r.qualified[2].bb).toBeGreaterThan(1.3);
    }
  });

  it("agrees with the winner's own arithmetic", () => {
    // Recompute the headline from raw snapshot fields, bypassing every helper.
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    const w = r.qualified[0];
    const minTok = Math.min(...snap.deepswe.configs.map((c) => c.meanOutputTokens));
    const minStep = Math.min(...snap.deepswe.configs.map((c) => c.meanAgentSteps));
    const craft = 1 / (1 + Math.pow(10, (r.referenceElo - craftEloOf(w)) / 400));
    const k =
      Math.pow(w.config.passAt1, 1 - DEFAULT_SETTINGS.craftWeight) *
      Math.pow(craft, DEFAULT_SETTINGS.craftWeight);
    const bb =
      (k * 100) /
      (w.config.meanCostUsd *
        Math.pow(w.config.meanOutputTokens / minTok, DEFAULT_SETTINGS.beta) *
        Math.pow(w.config.meanAgentSteps / minStep, DEFAULT_SETTINGS.gamma));
    expect(w.bb).toBeCloseTo(bb, 10);
  });
});

describe("why-it-won insights", () => {
  const { insights } = computeRanking(snap, DEFAULT_SETTINGS);

  it("reports the winner against the raw capability frontier", () => {
    // The frontier is now an UNRATED config: gpt-6-astra [xhigh] has the highest
    // ship on the board at 74.1%. `frontier` is defined on ship alone, so it is
    // correct to name it — and the contrast is the story of this refresh.
    expect(insights!.frontier.label).toBe("gpt-6-astra [xhigh]");
    expect(insights!.frontier.craft).toBeNull();
    expect(insights!.pctOfFrontierScore).toBeCloseTo(98.3, 0);
    // Only 1.07x cheaper now, because the frontier is no longer a $11.84 Opus
    // but a $6.52 astra. The gap between "best value" and "most capable" has
    // nearly closed on price — the interesting part is that it closed via a
    // config the site cannot rank.
    expect(insights!.cheaperThanFrontier).toBeCloseTo(1.07, 1);
  });

  it("shows what beating it on capability would cost", () => {
    expect(insights!.cheapestBetter!.label).toBe("claude-opus-5 [xhigh]");
    expect(insights!.cheapestBetterPriceMultiple).toBeGreaterThan(1);
  });

  it("computes the per-$100 hero stat", () => {
    expect(insights!.winner.solvedPer100).toBeCloseTo(12, 0);
    expect(insights!.frontier.solvedPer100).toBeCloseTo(11, 0);
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
    expect(m.kind !== "none" && m.entry.rating).toBeCloseTo(1662.6, 0);
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

  it("refills as new models arrive — qwen3.8-27b is waiting", () => {
    // The room emptied on Aug 13 after three graduations, then refilled: Arena
    // rates qwen3.8-27b ninth on WebDev (1595) and DeepSWE has not run it. The
    // cycle is the pipeline working, and the Radar section appears and hides
    // itself with the queue.
    const names = unrankedContenders(snap, EVERYDAY).map((c) => c.entry.modelDisplayName);
    expect(names).toContain("qwen3.8-27b");
    expect(snap.deepswe.configs.some((c) => c.modelDisplay.includes("qwen3.8-27b"))).toBe(false);
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
    expect(q.craft).toBeCloseTo(0.795, 2);
    expect(q.craftMatch.kind).toBe("family");
    expect(q.organization).toBe("Alibaba");
  });

  it("leaves the high-power answer untouched", () => {
    expect(r.qualified[0].label).toBe("claude-opus-5 [high]");
    expect(r.qualified.every((s) => s.label.startsWith("claude-opus-5"))).toBe(true);
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

describe("categoryWinners", () => {
  const r = computeRanking(snap, EVERYDAY);
  const cats = categoryWinners(r);

  it("answers each axis from qualified configs only", () => {
    // The cheapest config overall is always something that barely works. Every
    // category answer must be something the floors already vouched for.
    expect(cats.length).toBeGreaterThan(0);
    for (const c of cats) {
      expect(c.winner.qualified).toBe(true);
      expect(r.qualified).toContain(c.winner);
      expect(c.value.length).toBeGreaterThan(0);
    }
  });

  it("actually picks the extreme on each axis", () => {
    // A category that names anything other than the true best would be worse
    // than not having the section at all.
    const by = (id: string) => cats.find((c) => c.id === id)!.winner;
    const q = r.qualified;
    expect(by("value").bb).toBe(Math.max(...q.map((s) => s.bb)));
    expect(by("cheapest").config.meanCostUsd).toBe(Math.min(...q.map((s) => s.config.meanCostUsd)));
    expect(by("capable").ship).toBe(Math.max(...q.map((s) => s.ship)));
    expect(by("craft").craft).toBe(Math.max(...q.map((s) => s.craft ?? 0)));
    expect(by("lean").config.meanOutputTokens).toBe(
      Math.min(...q.map((s) => s.config.meanOutputTokens)),
    );
    expect(by("fastest").config.meanDurationSeconds).toBe(
      Math.min(...q.map((s) => s.config.meanDurationSeconds ?? Infinity)),
    );
  });

  it("names the best-value winner first", () => {
    expect(cats[0].id).toBe("value");
    expect(cats[0].winner.label).toBe(r.qualified[0].label);
  });

  it("has gpt-5.6-sol [high] sweeping value, leanest and fastest", () => {
    // The 2026-08-26 price cut left one config best on four axes at once. That
    // is what a decisive ranking looks like, and it is worth pinning: if these
    // ever split apart again, the everyday answer got close.
    const by = (id: string) => cats.find((c) => c.id === id)!.winner.label;
    expect(by("value")).toBe("gpt-5.6-sol [high]");
    expect(by("lean")).toBe("gpt-5.6-sol [high]");
    expect(by("fastest")).toBe("gpt-5.6-sol [high]");
  });

  it("returns nothing when nothing qualifies", () => {
    const none = computeRanking(snap, { ...DEFAULT_SETTINGS, shipFloor: 0.99 });
    expect(categoryWinners(none)).toEqual([]);
  });
});

describe("unvoted Arena entries are priors, not ratings", () => {
  const webdev = snap.arenaWebdev!.entries;

  it("classifies by votes, not by rating or rank", () => {
    // Tested on the function rather than on whatever the board happens to hold
    // this week — the guard has to be right when the next prior appears, and
    // the last one has already graduated.
    expect(isRated({ ...webdev[0], votes: 0 })).toBe(false);
    expect(isRated({ ...webdev[0], votes: 1 })).toBe(true);
    expect(isRated({ ...webdev[0], votes: 0, rating: 1900, rank: 1 })).toBe(false);
  });

  it("was vindicated: glm-5.3-flash's prior was 27 points optimistic", () => {
    // The reason this guard exists. On 2026-08-26 Arena listed it at 1634 with
    // zero votes; by 2026-09-03 real votes put it at 1607 with rank 14. Trusting
    // the prior would have overstated its Craft for a week. Kept as the standing
    // evidence that an unvoted Elo is not a small approximation of the truth.
    const real = webdev.find((e) => e.modelDisplayName === "glm-5.3-flash");
    expect(real).toBeDefined();
    expect(real!.votes).toBeGreaterThan(0);
    expect(real!.rating).toBeLessThan(1634);
  });

  it("keeps unvoted entries out of the reference median", () => {
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    const ratedOnly = webdev.filter(isRated).map((e) => e.rating).sort((a, b) => a - b);
    expect(r.referenceElo).toBe(ratedOnly[Math.floor(ratedOnly.length / 2)]);
  });

  it("keeps unvoted entries out of the contender list", () => {
    for (const settings of [DEFAULT_SETTINGS, EVERYDAY]) {
      for (const c of unrankedContenders(snap, settings)) {
        expect(c.entry.votes).toBeGreaterThan(0);
      }
    }
  });

  it("never lets an unrated config qualify at any setting", () => {
    // The invariant that must hold whether or not a prior is on the board today.
    for (const shipFloor of [0.1, 0.5, 0.65, 0.725]) {
      for (const craftFloor of [0, 0.5, 0.7, 0.75]) {
        const r = computeRanking(snap, { ...DEFAULT_SETTINGS, shipFloor, craftFloor });
        for (const c of r.qualified) expect(c.craft).not.toBeNull();
      }
    }
  });
});

describe("gpt-6-astra — measured, unrated, and the biggest gap yet", () => {
  const r = computeRanking(snap, DEFAULT_SETTINGS);

  it("has the highest Ship on the board and no Craft at all", () => {
    // Arena carries no gpt-6 entry on either board, so all five configs are
    // unrated and none can qualify — regardless of how good the measured half
    // looks. This is the Craft gate refusing to guess, which is the point.
    const astra = r.all.filter((s) => s.label.startsWith("gpt-6-astra"));
    expect(astra).toHaveLength(5);
    for (const a of astra) {
      expect(a.craft).toBeNull();
      expect(a.failed).toBe("unrated");
      expect(a.qualified).toBe(false);
    }
    const topShip = [...r.all].sort((a, b) => b.ship - a.ship)[0];
    expect(topShip.label).toBe("gpt-6-astra [xhigh]");
    expect(topShip.ship).toBeGreaterThan(0.74);
  });

  it("would win high power outright even at the WORST passing craft", () => {
    // The honest floor of its potential, and the reason it gets a section of
    // its own rather than a dimmed table row. astra [medium] matches the
    // winner's ship exactly while costing 28% less and using ~3x fewer tokens
    // and steps; at a bare 75% craft it would still beat the crown by >2x.
    const astra = r.all.find((s) => s.label === "gpt-6-astra [medium]")!;
    const winner = r.qualified[0];
    expect(astra.ship).toBeCloseTo(winner.ship, 2);
    expect(astra.config.meanCostUsd).toBeLessThan(winner.config.meanCostUsd);
    expect(astra.config.meanOutputTokens).toBeLessThan(winner.config.meanOutputTokens / 2);
    expect(astra.config.meanAgentSteps).toBeLessThan(winner.config.meanAgentSteps / 2);

    const potential = bbAtFloorCraft(astra, r, DEFAULT_SETTINGS)!;
    expect(potential).toBeGreaterThan(winner.bb * 2);
  });

  it("returns null potential for configs that already have a Craft score", () => {
    expect(bbAtFloorCraft(r.qualified[0], r, DEFAULT_SETTINGS)).toBeNull();
  });

  it("lists the unrated set by Ship, best first", () => {
    const m = unratedMeasured(r);
    expect(m).toHaveLength(5);
    for (let i = 1; i < m.length; i++) expect(m[i].ship).toBeLessThanOrEqual(m[i - 1].ship);
  });
});

describe("Craft is relative, so a fixed floor tightens as the field improves", () => {
  it("gated gpt-5.6-sol [max] out of high power without it getting worse", () => {
    // The subtlest result of this refresh. sol [max]'s Elo is unchanged at
    // 1617.7. claude-fable-5.1 entered the board at 1763 and dragged the median
    // from 1419.1 to 1434.6, which pushed sol's craft from 75.8% to 74.1% —
    // under a 75% floor it had cleared for weeks. Nothing about the model
    // changed; the bar it is measured against moved. Worth knowing before
    // reading any craft drop as a regression.
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    const sol = r.all.find((s) => s.label === "gpt-5.6-sol [max]")!;
    expect(craftEloOf(sol)).toBeCloseTo(1617.7, 0);
    expect(sol.failed).toBe("craft");
    expect(sol.ship).toBeGreaterThan(DEFAULT_SETTINGS.shipFloor);

    // At the previous median it would still qualify — the proof it was the
    // reference, not the model, that moved.
    expect(craftProbability(craftEloOf(sol), 1419.14)).toBeGreaterThan(DEFAULT_SETTINGS.craftFloor);
    expect(craftProbability(craftEloOf(sol), r.referenceElo)).toBeLessThan(DEFAULT_SETTINGS.craftFloor);
  });
});

describe("the date-stamp join fix", () => {
  it("still reaches Arena's date-stamped entry after it was relabelled", () => {
    // Arena listed this as "deepseek-v4-pro-max-20260813" on Aug 13 and
    // "deepseek-v4-pro-high-20260813" by Aug 20 — same model, reclassified
    // effort. The date strip is what matters and it still works: the [max]
    // config reaches the 1582 dated entry by borrowing the -high sibling.
    // Without the strip the join would fall through to the undated base model
    // at 1445, showing ~55% craft instead of ~72%.
    const dated = snap.arenaWebdev!.entries.find((e) =>
      /^deepseek-v4-pro-\w+-\d{8}$/.test(e.modelDisplayName),
    );
    expect(dated).toBeDefined();
    const m = craftFor(
      snap.deepswe.configs.find((c) => c.modelDisplay === "deepseek-v4-pro" && c.effort === "max")!,
      snap.arenaWebdev!.entries,
    );
    expect(m.kind !== "none" && m.entry.modelDisplayName).toBe(dated!.modelDisplayName);
    expect(m.kind !== "none" && m.entry.rating).toBeGreaterThan(1500);
  });

  it("keeps deepseek-v4-pro [max] out, and its price advantage shrank 4x", () => {
    // Flagged on Aug 13 as the most disruptive near-miss: $0.06 per task, 100x
    // cheaper than the winner. The Aug 20 re-run repriced it to $0.24 — still
    // cheap, no longer extraordinary — and its craft fell to 72% when Arena
    // relabelled the dated entry. It was gated on ship either way, so the
    // ranking never moved; the watch item is simply less urgent than it looked.
    const r = computeRanking(snap, DEFAULT_SETTINGS);
    const d = r.all.find((s) => s.label === "deepseek-v4-pro [max]")!;
    // Repriced twice more since: $0.06 -> $0.24 -> $1.67. The "100x cheaper
    // than the winner" framing I used on Aug 13 aged badly in under two weeks.
    expect(d.config.meanCostUsd).toBeCloseTo(1.67, 1);
    expect(d.failed).toBe("both");
    expect(d.ship).toBeLessThan(EVERYDAY.shipFloor);
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

  it("has 70 configs and both Arena boards", () => {
    // 70 since the 2026-09-03 run added gpt-6-astra x5 and gemini-3.8-flash x2.
    expect(snap.deepswe.configs).toHaveLength(70);
    expect(snap.arena!.entries.length).toBeGreaterThan(50);
    expect(snap.arenaWebdev!.slug).toBe("code-webdev");
    expect(snap.arenaWebdev!.entries.length).toBeGreaterThan(100);
  });

  it("has claude-fable-5.1-max topping the WebDev board", () => {
    // New #1 as of 2026-09-03 at 1763 Elo — the strongest WebDev rating this
    // site has recorded, and the single biggest cause of the median jump.
    // DeepSWE has not run claude-fable-5.1, so it sits in the waiting room.
    const top = snap.arenaWebdev!.entries.filter((e) => e.votes > 0)[0];
    expect(top.modelDisplayName).toBe("claude-fable-5.1-max");
    expect(top.rating).toBeGreaterThan(1750);
    expect(snap.deepswe.configs.some((c) => c.modelDisplay.startsWith("claude-fable-5.1"))).toBe(false);
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
