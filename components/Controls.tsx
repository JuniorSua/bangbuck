"use client";

import type { Settings } from "@/lib/score";
import { DEFAULT_SETTINGS, TIER_PRESETS } from "@/lib/score";
import { pct } from "@/lib/format";

/**
 * The formula is a judgment call, not a law. Exposing the knobs is how the site
 * stays honest: anyone who disagrees can move a slider and see the answer change.
 */
export function Controls({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
}) {
  const isDefault = (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).every(
    (k) => settings[k] === DEFAULT_SETTINGS[k],
  );

  const activePreset = TIER_PRESETS.find(
    (p) =>
      Math.abs(p.shipFloor - settings.shipFloor) < 0.001 &&
      Math.abs(p.craftFloor - settings.craftFloor) < 0.001,
  );

  return (
    <section className="card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {activePreset?.blurb ?? "Custom floors — set below."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Two named tiers for the two questions people actually arrive with;
              the slider underneath stays available for anything in between. */}
          <div className="seg" role="group" aria-label="Capability tier">
            {TIER_PRESETS.map((p) => (
              <button
                key={p.id}
                aria-pressed={activePreset?.id === p.id}
                onClick={() =>
                  onChange({ ...settings, shipFloor: p.shipFloor, craftFloor: p.craftFloor })
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          {!isDefault && (
            <button
              onClick={() => onChange(DEFAULT_SETTINGS)}
              className="text-xs underline underline-offset-2"
              style={{ color: "var(--text-muted)" }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Slider
          label="Ship floor"
          value={settings.shipFloor}
          display={pct(settings.shipFloor, 1)}
          min={0.1}
          max={0.75}
          step={0.005}
          onChange={(shipFloor) => onChange({ ...settings, shipFloor })}
          help="Minimum share of real repo tasks it has to finish. This is what stops cheap-but-unreliable models winning on price alone."
        />
        <Slider
          label="Craft floor"
          value={settings.craftFloor}
          display={pct(settings.craftFloor, 0)}
          min={0.3}
          max={0.9}
          step={0.01}
          onChange={(craftFloor) => onChange({ ...settings, craftFloor })}
          help="How often a human must prefer its web work over a typical model's. Drop this below 70% and gpt-5.6-luna [max] comes back — cheapest on the board, and judged worse than everything above it."
        />
        <Slider
          label="Output-token penalty"
          value={settings.beta}
          display={settings.beta.toFixed(2)}
          min={0}
          max={0.6}
          step={0.05}
          onChange={(beta) => onChange({ ...settings, beta })}
          help="How much to penalise verbose models. Tokens mostly stand in for wall-clock time, since dollars are already counted in cost."
        />
        <Slider
          label="Agent-step penalty"
          value={settings.gamma}
          display={settings.gamma.toFixed(2)}
          min={0}
          max={0.6}
          step={0.05}
          onChange={(gamma) => onChange({ ...settings, gamma })}
          help="How much to penalise models that take many turns to finish a task."
        />
      </div>

      <p className="mt-5 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        <span className="font-mono">
          BangBuck = ship^{(1 - settings.craftWeight).toFixed(1)} × craft^
          {settings.craftWeight.toFixed(1)} ÷ (cost × tokens^{settings.beta.toFixed(2)} × steps^
          {settings.gamma.toFixed(2)})
        </span>
        , computed only for configs clearing <em>both</em> floors. The two capability terms multiply
        rather than average, so being good at one cannot cover for being weak at the other. Token and
        step penalties are relative to the leanest config in the set.
      </p>
    </section>
  );
}

function Slider({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  help,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  help: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-xs uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
          {label}
        </label>
        <span className="tnum text-sm font-medium" style={{ color: "var(--accent)" }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {help}
      </p>
    </div>
  );
}
