# BangBuck

**Which AI coding model gives you the most work per dollar?**

Leaderboards rank models by raw capability, so the most expensive model always wins. BangBuck ranks
coding models by how much work you get per dollar — using *measured benchmark cost*, not list price.

Currently: **claude-opus-5 [high]** — finishes 72.8% of real repo tasks at $6.08 each, and humans
prefer its web work to a typical model's 82% of the time. It leads the high-power tier by 1.36×.

---

## The formula

A model has to clear **two** bars, then price decides among the survivors.

```
SHIP   DeepSWE pass@1          measured     can it finish the job?
CRAFT  Arena WebDev Elo -> P(win)  human-judged  is the result worth keeping?

1. Gate       qualified = ship >= shipFloor AND craft >= craftFloor
2. Capability K = ship^(1-craftWeight) * craft^craftWeight     (geometric, conjunctive)
3. Efficiency BangBuck = K / (cost × tokens^beta × steps^gamma)
```

Defaults: `shipFloor 0.725`, `craftFloor 0.75`, `craftWeight 0.60`, `beta 0.20`, `gamma 0.20` —
all in `DEFAULT_SETTINGS` in `lib/score.ts`, all sliders in the UI.

### Why two axes

Version 1 had one capability number and crowned **gpt-5.6-luna [max]**: 67.2% of tasks at $0.61,
unbeatable on price. That was wrong. DeepSWE measures whether an agent can close a real issue; it
says nothing about whether the code is any good. On Arena's WebDev board luna sits at 1523 Elo
against claude-opus-5's 1703 — a human prefers Opus's work **74% of the time**. Luna could finish
the job and hand you something you would not ship.

**The two terms multiply rather than average.** A geometric mean is conjunctive: a hole on one axis
cannot be filled in by a spike on the other. An arithmetic mean would let luna's cheap, capable
agentic score paper over its weak code, which is the exact failure being corrected.

### Why the floors are hard gates, and the weight is nearly decoration

Worth knowing before tuning anything — `npx tsx scripts/sensitivity.ts` prints the evidence:

- Sweeping `craftWeight` from **0 to 1** never changes the winner. Scores move ~2%, because across
  qualifying configs craft spans ~1.3× while cost spans ~20×. Cost dominates; capability is
  second-order.
- Sweeping `craftFloor` flips the winner **twice**: at 65% it is luna [max], at 70% gpt-5.6-sol
  [high], at 80% claude-opus-5 [medium].

So a soft "bias toward coding" does not work — weighting alone would still crown luna. The **gate**
is what changes the answer. That is why both floors are plain percentages: they are the knobs that
actually carry the judgment.

### Craft coverage — read this before trusting a row

Arena rates only **12 of the 53** configurations exactly. The rest borrow the nearest reasoning
effort of the same model, and every table row marks this with `~`.

Borrowing is defensible because the axes divide the work cleanly: effort shows up on Ship, which is
measured per configuration, while Craft is mostly a property of the model — its taste in code does
not change when you let it think longer. **Nearest** effort matters though, not the family's best:
taking the top rating would hand a `[low]` config its `[max]` sibling's score, flattering exactly
the configs least entitled to it. See `craftFor` in `lib/normalize.ts`.

### Tiers

**High power** (ship ≥72.5%, craft ≥75%) is the default — 4 configs qualify and `claude-opus-5
[high]` wins by 1.36×, rated exactly rather than by inheritance. **Everyday** (ship ≥65%, craft
≥70%) is a genuine tie: `gpt-5.6-sol [high]` and `claude-opus-5 [medium]` land 4% apart, which is
noise, and the UI says so rather than pretending it is a ranking.

**Why tokens and steps barely matter (exponent 0.20).** Dollars are already fully captured by cost.
Tokens and steps are proxies for wall-clock time and context-overflow risk — real, but secondary.
At 0.20 they act as a tiebreaker between configs of similar capability and price.

### Rated, but not rankable

A model can be excellent and still be unscoreable here. Craft alone is not enough, because the
formula divides by **measured** cost per task — and Arena publishes list price per million tokens,
which says nothing about how many tokens a model burns finishing a real repo task.

`unrankedContenders()` finds them: anything clearing the Craft floor whose family DeepSWE has never
run. They get their own section rather than silently vanishing, because a reader who cannot find a
model they just saw enter Arena at #4 would reasonably assume it had been judged and rejected.

**qwen3.8-max** was the proving case, and it graduated in one day. On 3 Aug 2026 it entered Arena's
WebDev board at #4 (1668 Elo, level with `claude-opus-5 [high]`) with no DeepSWE data, so it sat
here with Alibaba's claimed **56.6 on DeepSWE 1.1** shown as self-reported. On 4 Aug DeepSWE ran it:
**57.5% (CI 54.8–60.1) at $3.73/task** — the claim sat inside the measured interval, and the model
moved from this section into the ranking automatically, where the Ship gate excludes it exactly as
its own numbers predicted. The pipeline worked end to end: honest waiting room, measured
graduation, no hand-editing. It has now happened twice: `deepseek-v4-flash [max]` graduated on
7 Aug ($0.10/task measured — and 53.3% ship, gated out). `grok-4.6-high` is the current occupant.

Self-reported figures live in `lib/notes.ts`, never in `data/snapshot.json`, and a test asserts none
of them can reach the ranking. Every note carries a URL a reader can open.

### A known weakness, pinned by a test

At the everyday tier the winner is **dominated**: `claude-opus-5 [medium]` is both cheaper ($3.29 vs
$3.47) and more capable (0.762 vs 0.740) than `gpt-5.6-sol [high]`, which wins only on the token and
step penalties (28k/37 against 37k/52). A tiebreaker standing in for wall-clock time is overturning
both axes the formula claims to rank on.

Left as-is: the penalties are a deliberate judgment call, the gap is 4%, and the UI reports it as a
tie rather than a ranking. Set `beta = gamma = 0` and the order reverses. Two tests pin this so it
stays a decision rather than an accident — if they start failing, the penalties were retuned and the
everyday answer moved.

The high-power tier has no such problem: `claude-opus-5 [high]` is dominated by nothing, and holds
first place across every penalty setting from 0 to 0.6 and every craft weight from 0 to 1.

### The regime bar

`craftFloorRegimes` sweeps the Craft floor end to end and collapses it into the few bands where the
winner does not change — printed by `npx tsx scripts/tiers.ts`. At the everyday bar that is the
whole history of this project in one row:

```
any–67%  gpt-5.6-luna [max]        15 qualify   <- what v1 answered
67%–78%  gpt-5.6-sol [high]        12 qualify
78%–82%  claude-opus-5 [medium]     9 qualify   <- the original hand-pick
82%–84%  kimi-k3 [max]              3 qualify
84%–100% claude-opus-5 [xhigh]      2 qualify
```

Breakpoints can only fall ON a craft value present in the data — between two adjacent values no
config enters or leaves — so the bands are computed exactly in ~30 passes rather than approximated
by a fine scan.

The chart's **metric tabs** are not decoration. Cost / Output tokens / Agent steps are exactly the
inputs the formula consumes, so switching tabs shows *which* one carries a given model's rank. The
fourth tab, Craft, plots the two capability axes against each other and draws both floors — only
the upper-right quadrant competes, which is the whole argument in one picture. Every axis runs
better-to-the-right, so a tab change never flips the reader's sense of which way is good.

---

## Sharing a tuned view

The link preview is generated from the ranking itself — `app/opengraph-image.tsx` calls
`computeRanking` and renders a 1200x630 card at build time, so the preview can never disagree with
the page and there is no separate asset to remember to update. When the answer changes, so does the
card, on the next build.


Settings live in the query string, so "here is the same data under my assumptions" is a link:
`?s=` ship floor, `c=` craft floor, `w=` craft weight, `b=` beta, `g=` gamma. Only knobs moved off
default appear. Values outside 0..1 are ignored rather than trusted, so a hand-edited URL cannot
render a nonsense ranking. Written with `replaceState` so dragging a slider does not fill the back
button.

---

## ⚠️ The one trap in this codebase

**Do not "simplify" the DeepSWE scraper to fetch `/artifacts/v1.1/leaderboard-live.json`.**

That endpoint returns HTTP 200 and looks authoritative, but it is CDN-cached with outdated pricing.
It reports `gpt-5.6-luna [max]` at **$3.028** when the live price is **$0.6056** — a 5× difference
that changes the winner. Cache-busting does not help. Only two models currently differ between the
two sources, so the bug is easy to miss and silently produces a wrong answer.

`lib/sources/deepswe.ts` scrapes the live page and **throws** if luna [max] comes back above $2.
Leave that guard in.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 28 golden tests
npm run build        # production build; all routes prerender static
```

The site is **fully static** — no database, no cron, no network calls at request time. Everything
comes from `data/snapshot.json`, which is committed.

### Refreshing the data

```bash
npm run refresh -- --dry-run   # scrape both sources, print a diff, write nothing
npm run refresh                # same, then rewrite data/snapshot.json
```

Scraping only ever runs from the CLI, so a broken scrape shows up in your terminal rather than in
front of a visitor. `refresh` prints every config added, removed, or moved more than 2% before it
writes, and refuses to write a partial scrape over good data.

This is deliberate, not laziness: benchmark results only change when a new model is evaluated, so
polling on a timer is wasted work. The plan is event-driven instead — see *Not built yet*.

---

## Layout

```
lib/score.ts            The formula. PURE — no I/O. This is the piece that encodes the judgment call.
lib/score.test.ts       71 golden tests. The numbers here were verified by hand before any code existed.
lib/sources/deepswe.ts  Scrapes the live SSR page (seroval-serialised TanStack payload). Read the trap above.
lib/sources/arena.ts    Scrapes arena.ai's RSC flight payloads — both boards. See ARENA_BOARDS.
lib/diff.ts             Snapshot-to-snapshot comparison. Also the engine for the planned release watcher.
lib/normalize.ts        Name joining. craftFor() resolves a config to a WebDev Elo + its provenance.
lib/metrics.ts          The four chart axes + readable tick generation (zero-anchored and fitted).
lib/vendors.ts          Canonical vendor names + aliases. Asserted against the data by a test.
lib/notes.ts            Hand-written, sourced notes on models the scrapers cannot score.
                        Self-reported only; a test keeps them out of the ranking.
components/             UI. ScatterChart.tsx is the dense one; read its module comment first.
                        RankTable.tsx filters on "/" — model, effort and vendor together.
                        Dashboard.tsx owns tuning state and mirrors it into the URL.
                        SectionHead.tsx numbers the page so it reads as one argument.
                        StickyAnswer.tsx carries the winner once its card scrolls away.
                        Hero.tsx is the oversized wordmark and meta strip.
                        VendorMark.tsx draws the company marks — see the note below.
data/snapshot.json      The source of truth. Committed.
scripts/                refresh.ts plus three throwaway analysis scripts (hindsight, sensitivity, tiers).
```

**If you change the formula, expect `score.test.ts` to fail.** That is the point — those numbers are
a contract, not a snapshot of current behaviour. Re-agree them consciously rather than updating them
to match whatever the code now does.

Two tests are worth understanding before you touch anything:

- **`hindsight check`** — rewinding the field to before the gpt-5.6 generation shipped must
  reproduce `claude-opus-5 [medium]` as the winner. That was the pick made by hand, and DeepSWE's own
  2026-06-20 snapshot confirms none of luna/sol/terra existed then. If this breaks, the formula has
  drifted away from the judgment it was built to encode.
- **`valueFrontier`** — every config excluded from the frontier must be genuinely dominated by
  something on it.

---

## Two traps in the UI

**Chart type does not scale with the chart.** The SVG has a fixed 860-unit viewBox fitted to its
container, so on a 390px phone a 10.5px label rendered at 4.8 real pixels — legible in the source,
invisible on the device. `ScatterChart` measures its container and multiplies every font size by the
inverse of that scale, holding type at a constant *physical* size. Past a threshold it also thins
out: fewer ticks, no legend, winner-only labels. If you add text to that chart, size it through
`fs()`.

**Never put a raw float anywhere the server and client both render it.** This has bitten twice,
through two different doors, and both are hydration mismatches:

- *CSS values.* The browser truncates percentages when parsing, so a bar width of
  `73.54960673390156%` reads back out of the server HTML as `73.5496%`. See `RankTable.tsx`.
- *SVG coordinates.* `Math.log10` is only implementation-**approximated** by the spec, so Node and
  the browser may differ in the last bit — enough to emit `cx="96.75098312865315"` on the server and
  `96.75098312865306` on the client. `ScatterChart` therefore rounds inside its `x()` and `y()`
  scales, which covers every coordinate derived from them.

The rule: round at the point a number becomes geometry, not at each call site. Two decimals in an
860-unit viewBox is about a hundredth of a pixel — invisible, and it removes the class of bug rather
than one instance. A quick check that nothing regressed:

```
curl -s localhost:3000 | grep -oE '(cx|cy|points|width|height)="[^"]*"' | grep -E '\.[0-9]{4,}'
```

That should print nothing.

---

## Chart constraints that are not cosmetic

`components/ScatterChart.tsx` has three rules that look like style but are load-bearing:

1. **The cost axis must stay logarithmic.** Costs span $0.014–$26.40; a linear axis crushes everything
   interesting into the left edge.
2. **Ranks 2 and 3 must carry labels in their own colour.** Orange vs aqua clears colourblind
   separation only marginally; the coloured label is the secondary encoding that makes it safe. The
   three podium hues are the only trio that passes all-pairs CVD separation on this surface — don't
   substitute them, and don't give all 18 models their own hue.
3. **The grey field never renders at full opacity.** Aqua collides with raw `--text-muted`; it only
   separates once that grey is composited down.

Hover uses nearest-point detection rather than per-mark hit targets, so no mark can occlude another.
Marks have `pointerEvents: none` on purpose.

### Vendor marks

`lib/brand-logos.ts` holds the official marks, generated by `npx tsx scripts/fetch-logos.ts` from
the Iconify API and **committed** — the site is static and must not depend on a CDN at runtime.
Re-run that script only when a vendor rebrands.

No single icon set carries all seven: simple-icons has no OpenAI and no xAI, so those come from the
`logos` set. Moonshot uses the **Kimi** mark, because the models are named `kimi-*` and that is the
brand a reader recognises. Google is the one `multicolour: true` entry — its identity *is* the
four-colour G, so tinting it would be wrong rather than restrained. The other six inherit
`currentColor`, for the same reason ranks 4-18 stay grey. Two of them (OpenAI, Grok) ship with no
`fill` attribute, so `VendorMark` sets `fill="currentColor"` on the wrapping `<svg>` — without it
they default to black and disappear.

These are third-party trademarks, used to identify each company's models in a comparison. They are
not covered by this project's licence.

Vendor names come from Arena and two are not guessable from the model prefix: grok ships under
**"SpaceXAI"** and muse-spark under **"Meta"**. `lib/vendors.ts` holds the canonical list, and a test
asserts every organization in the data resolves to a mark — a missing one degrades to a generic
circle, which reads as a design choice rather than a gap.

---

## Data & attribution

BangBuck does not run benchmarks. It reads published results and applies a cost-efficiency formula.

- **[DeepSWE](https://deepswe.datacurve.ai/)** by Datacurve — 53 configurations across 113
  long-horizon software engineering tasks. Every measured figure in the ranking comes from here.
  Benchmark harness is [Apache-2.0](https://github.com/datacurve-ai/deep-swe).
- **[Arena WebDev](https://arena.ai/leaderboard/code)** — 107 models rated by human preference on
  web development. This is the Craft axis. Note the URL: `/leaderboard/code` **is** the WebDev
  board — it and `/leaderboard/code/webdev` serve byte-identical entries and the page titles itself
  "WebDev AI Leaderboard". There is one coding board here, not a parent with children.
- **[Arena chat](https://arena.ai/leaderboard)** — general-conversation Elo and list pricing. Shown
  for context and deliberately kept **out** of the score: a model's chat ranking says little about
  its code, which is the mistake this ranking was rebuilt to avoid.

Arena has no measured cost, tokens, or steps, so it only ever decides whether a model is good enough
to compete — never how cheap it is.

Both are scraped from public pages. Model names, scores, and pricing belong to their respective
projects and vendors.

---

## Not built yet

- **Release watcher.** Mark an expected model release, poll both sources daily *until* its score and
  cost appear, then notify and stop. `lib/sources/*` and `lib/diff.ts` are the whole engine already;
  v2 adds scheduling and a notification channel.
- Price-change history (would have caught luna's 5× cut automatically — needs storage).
- **A second Craft source.** Today the Craft axis rests on one human-vote board.
  [Artificial Analysis](https://artificialanalysis.ai/agents/coding-agents) publishes a Coding Agent
  Index averaging cost-per-task across DeepSWE, Terminal-Bench v2 and SWE-Atlas-QnA — the natural
  next axis behind the same `lib/sources/*` interface.
- Personal-budget mode: "I spend $200/month — here's what to switch to and what you'd save."

---

## A note on the formula

It's a judgment call, not a law. The site says so, shows the knobs, and keeps every excluded config
visible in the table so you can see what the floor threw out. If you disagree, move a slider — and
if you think the defaults are wrong, open an issue with the numbers.
