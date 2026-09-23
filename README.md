# BangBuck

Compare AI coding configurations by capability, measured task cost, output tokens, and agent steps.
Each configuration must pass two explicit floors before its BangBuck score can compete.

## Current snapshot

At the **September 23, 2026 capture**, Astra medium leads high power and Astra low leads everyday.
Both inherit the Arena WebDev rating for **Astra max**; these effort levels do not have direct
WebDev ratings. The page names that source, reports its votes and rating interval, and distinguishes
estimated preference from measured task completion.

Run `npx tsx scripts/tiers.ts` to calculate the current answers from `data/snapshot.json`.
The page and category cards compute their results from that same snapshot. Historical observations
are preserved in [the earlier notes](docs/history-before-2026-09-10.md), the September 10 review
is in [the reassessment](docs/analysis-2026-09-10.md), and the September 22 refresh with an outside
check against other coding boards is in [its notes](docs/analysis-2026-09-22.md). The September 23
[Artificial Analysis second opinion](docs/analysis-2026-09-23.md) adds a third, independent source.

## Formula and defaults

```text
qualified = ship >= shipFloor AND craft >= craftFloor
capability = ship^(1 - craftWeight) × craft^craftWeight
BangBuck = 100 × capability /
           (cost × (outputTokens / minOutputTokens)^beta × (steps / minSteps)^gamma)
```

- **Ship:** DeepSWE pass@1, measured per model and effort.
- **Craft:** Elo-derived WebDev preference against the board reference. This is an estimate,
  not an observed head-to-head win percentage or a measure of general code maintainability.
- **Cost:** measured mean dollars per benchmark attempt, never list price per million tokens.
- **Tokens and steps:** separate resource penalties alongside dollars. The owner selected
  `beta = gamma = 0.25`; these settings remain unchanged.
- **Baselines:** smallest output-token and step values across the entire snapshot. Changing a
  qualification floor does not rescale the scores.

Defaults live in `lib/score.ts`: Ship ≥72.5%, Craft ≥75%, Craft weight 0.60, beta/gamma 0.25.
Everyday uses Ship ≥65%, Craft ≥70% with the same weights. “Best value” need not be the cheapest
qualifier or the fastest one; category cards show those separate answers.

Hard floors enforce each minimum independently. The geometric blend shapes capability within the
qualifying field. Qualification uses point estimates: a winner whose Ship interval crosses the
floor is explicitly marked. The UI's “photo finish” threshold is a 5% score-gap heuristic, not a
statistical significance test.

## Evidence and matching

`lib/normalize.ts` prefers an exact model/effort Arena entry, then the nearest available effort
within the same model family. Borrowed Craft is a modeling assumption, especially when low effort
inherits a max-effort rating. The winner card, category cards, sticky answer, and expandable table
rows disclose the source. Equal inherited Craft scores are shown as ties.

How much that assumption can cost is measured, not guessed. Families with several rated efforts
drift 8.4–23.3 Elo per effort step (median 20.4). On the 2026-09-10 data both gpt-6-astra crowns
borrow max's rating across 3–4 steps, yet they hold at 40 Elo/step and only flip near 60.
`lib/refresh.test.ts` pins that check, so the next single-entry family gets the same scrutiny.

Entries with zero votes are priors and cannot supply Craft, qualify a model, or move the reference.
Missing Craft leaves a configuration unranked. The radar shows its potential only when its measured
Ship already passes the active floor. A model with Arena evidence but no DeepSWE measurements stays
in the waiting list. List prices and notes in `lib/notes.ts` never supply measured ranking inputs.

Craft is relative: a moving board reference can change qualification even when a model's own Elo
is unchanged. `scripts/sensitivity.ts` and `scripts/tiers.ts` help inspect that dependence.
`craftFloorRegimes()` represents inclusive/exclusive floating-point boundaries correctly: equality
passes, and floors above every measured score have no winner.

## Refresh and change history

```bash
npm run refresh -- --dry-run   # fetch sources and report changes without writing
npm run refresh               # save snapshot and paired public update summary
```

The refresh compares against the **saved working snapshot**, not Git HEAD. It reports:

- DeepSWE additions, removals, and material changes to measured scoring fields;
- Arena additions, removals, and changed entries, including votes;
- Craft source/effort changes and the reference movement;
- before/after tier winners and configurations entering or leaving qualification.

Arena-only changes can change both winners with no new benchmark run. A fixed regression case
covers exactly that transition. `data/update.json` contains a compact change summary paired to the
snapshot's capture timestamp; the page hides it if the timestamps differ. Capture-time-only changes
do not count as new evidence. A refresh is not a deployment: rebuild to update a hosted static page.

**DeepSWE source trap:** `lib/sources/deepswe.ts` reads the live page. Do not replace it with
`/artifacts/v1.1/leaderboard-live.json`: that endpoint previously served outdated pricing despite
HTTP 200, changing the answer. The existing Luna price guard remains in place.

## Running and checking

```bash
npm install
npm run dev                  # local Next.js server
npm test                     # historical regressions and current-data contracts
npm run build:check          # isolated production build, preserving the dev server
npx tsx scripts/tiers.ts
npx tsx scripts/sensitivity.ts
```

The app is a static Next.js page importing the saved snapshot. It makes no source requests while a
visitor uses it. Refresh scripts own source fetching; unavailable WebDev evidence aborts refresh.
General-chat and Artificial Analysis data are optional and never drive the ranking.

Historical expected winners use `lib/fixtures/2026-09-05.json`. The Astra rating fixture isolates the
Arena-only graduation. Current-snapshot tests assert integrity and qualification rules without
requiring a particular model to keep winning. Future data refreshes should not rewrite history.

Settings are shareable through query parameters: `s` Ship floor, `c` Craft floor, `w` Craft weight,
`b` token penalty, and `g` step penalty. The existing social preview uses default settings at build
time; it does not reflect custom query parameters.

## Sources

- [DeepSWE, Datacurve](https://deepswe.datacurve.ai/): measured task pass rates, confidence intervals,
  cost, output tokens, agent steps, and duration. [Benchmark repository](https://github.com/datacurve-ai/deep-swe).
- [Arena WebDev](https://arena.ai/leaderboard/code): human-preference ratings for web development.
- [Arena chat](https://arena.ai/leaderboard): context and list pricing only.
- [Artificial Analysis](https://artificialanalysis.ai/): independent Intelligence Index, Terminal-Bench,
  Coding Agent Index, cost to run, and speed. A second opinion shown beside the ranking, never scored:
  its cost per task covers a mixed suite, not repo tasks. Read from public pages; no API key.

BangBuck applies an opinionated formula to published evidence; it does not run these benchmarks.
