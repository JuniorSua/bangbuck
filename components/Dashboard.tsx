"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  bbAtFloorCraft,
  categoryWinners,
  computeRanking,
  DEFAULT_SETTINGS,
  unrankedContenders,
  unratedMeasured,
  type Settings,
} from "@/lib/score";
import type { Snapshot } from "@/lib/types";
import { WinnerCard } from "./WinnerCard";
import { Controls, TierSelector } from "./Controls";
import { RankTable } from "./RankTable";
import { ScatterChart } from "./ScatterChart";
import { DataProvenance } from "./DataProvenance";
import { AppNav } from "./AppNav";
import { Hero } from "./Hero";
import { SectionHead } from "./SectionHead";
import { StickyAnswer } from "./StickyAnswer";
import { Radar } from "./Radar";
import { Categories } from "./Categories";
import { UpdateSummary } from "./UpdateSummary";
import type { SnapshotUpdate } from "@/lib/diff";
import { awaitingMeasurement } from "@/lib/notes";

/** Compact query-string form, so only knobs moved off default appear in the URL. */
const KEYS: (keyof Settings)[] = ["shipFloor", "craftFloor", "craftWeight", "beta", "gamma"];
const SHORT: Record<keyof Settings, string> = {
  shipFloor: "s",
  craftFloor: "c",
  craftWeight: "w",
  beta: "b",
  gamma: "g",
};

function readSettings(search: string): Settings {
  const q = new URLSearchParams(search);
  const out = { ...DEFAULT_SETTINGS };
  for (const k of KEYS) {
    const raw = q.get(SHORT[k]);
    if (raw === null) continue;
    const v = Number(raw);
    // Anything unparseable or out of range falls back to the default rather than
    // rendering a nonsense ranking from a hand-edited URL.
    if (Number.isFinite(v) && v >= 0 && v <= 1) out[k] = v;
  }
  return out;
}

/**
 * Holds the tuning state. The ranking is recomputed client-side from the snapshot,
 * which is cheap (50 configs) and makes the sliders feel instant.
 *
 * Settings live in the URL so a tuned view is shareable — the formula is a
 * judgment call, and "here is the same data under my assumptions" is the only way
 * to argue with it properly. The URL is written with replaceState so dragging a
 * slider does not fill the back button with intermediate states.
 */
export function Dashboard({ snapshot, update }: { snapshot: Snapshot; update: SnapshotUpdate | null }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const ranking = useMemo(() => computeRanking(snapshot, settings), [snapshot, settings]);
  const contenders = useMemo(() => unrankedContenders(snapshot, settings), [snapshot, settings]);
  const categories = useMemo(() => categoryWinners(ranking), [ranking]);

  // Configs DeepSWE measured that Arena never rated, plus what each would score
  // if its Craft came in at exactly the reader's floor — the honest floor of
  // its potential rather than a flattering guess.
  const measured = useMemo(() => unratedMeasured(ranking), [ranking]);
  const releases = useMemo(
    () => awaitingMeasurement(new Set(snapshot.deepswe.configs.map((c) => c.modelDisplay))),
    [snapshot],
  );
  const measuredPotential = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of measured) {
      const bb = bbAtFloorCraft(s, ranking, settings);
      if (bb !== null) m.set(s.label, bb);
    }
    // Stashed under a reserved key so the component can say "would beat today's
    // winner" without needing the whole ranking passed down.
    if (ranking.qualified[0]) m.set("__winner__", ranking.qualified[0].bb);
    return m;
  }, [measured, ranking, settings]);

  // Read once on mount rather than during render: the server has no location, and
  // initialising state from it directly would mismatch on hydration.
  useEffect(() => {
    const fromUrl = readSettings(window.location.search);
    if (KEYS.some((k) => fromUrl[k] !== DEFAULT_SETTINGS[k])) setSettings(fromUrl);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    for (const k of KEYS) {
      if (settings[k] !== DEFAULT_SETTINGS[k]) q.set(SHORT[k], String(Number(settings[k].toFixed(4))));
    }
    const next = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`);
  }, [settings]);

  // Watched by the sticky bar, which reveals itself once this scrolls past.
  const answerRef = useRef<HTMLElement>(null);

  return (
    <>
    <AppNav />
    <main id="top" className="app-shell">
      <StickyAnswer ranking={ranking} watch={answerRef} />
      <Hero snapshot={snapshot} />
      <UpdateSummary update={update} capturedAt={snapshot.capturedAt} />

      {/* One argument in order, not five widgets: the answer, the bar it had to
          clear, what paying more buys, everything that lost, and the receipts. */}
      <div className="app-sections">
        <section id="answer" className="app-section" ref={answerRef}>
          <SectionHead n={1} title="The answer" aside="at your selected tier" />
          <TierSelector settings={settings} onChange={setSettings} />
          <WinnerCard insights={ranking.insights} settings={settings} />
        </section>

        {categories.length > 0 && (
          <section className="app-section reveal">
            <SectionHead n={2} title="Best in each category" aside="all clear both bars" />
            <Categories categories={categories} />
          </section>
        )}

        <section className="app-section reveal">
          <SectionHead n={3} title="Set your bar" aside="the formula is a judgment call" />
          <Controls settings={settings} onChange={setSettings} />
        </section>

        <section id="compare" className="app-section reveal">
          <SectionHead
            n={4}
            title="What paying more buys"
            aside={`${ranking.qualified.length} of ${ranking.all.length} still standing`}
          />
          <ScatterChart ranking={ranking} />
        </section>

        <section id="rankings" className="app-section reveal">
          <SectionHead
            n={5}
            title="The whole field"
            aside="dimmed rows failed a floor"
          />
          <RankTable ranking={ranking} />
        </section>

        {(contenders.length > 0 || measured.length > 0 || releases.length > 0) && (
          <section className="app-section reveal">
            <SectionHead
              n={6}
              title="Not rankable yet"
              aside={`${measured.length + contenders.length + releases.length} missing data`}
            />
            <Radar
              contenders={contenders}
              measured={measured}
              releases={releases}
              measuredPotential={measuredPotential}
              settings={settings}
            />
          </section>
        )}

        <section id="sources" className="app-section reveal">
          <SectionHead n={7} title="Receipts" aside="nothing here is measured by us" />
          <DataProvenance snapshot={snapshot} />
        </section>
      </div>

      <footer className="mt-24 border-t pt-8 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        BangBuck reads published benchmarks and applies one opinionated formula. Disagree? The
        sliders are right there.
      </footer>
    </main>
    </>
  );
}
