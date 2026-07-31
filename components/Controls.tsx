"use client";

import type { Settings } from "@/lib/score";
import { DEFAULT_SETTINGS, FLOOR_PRESETS } from "@/lib/score";
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
  const isDefault =
    settings.floor === DEFAULT_SETTINGS.floor &&
    settings.beta === DEFAULT_SETTINGS.beta &&
    settings.gamma === DEFAULT_SETTINGS.gamma;

  const activePreset = FLOOR_PRESETS.find((p) => Math.abs(p.floor - settings.floor) < 0.001);

  return (
    <section className="card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium tight" style={{ color: "var(--text-primary)" }}>
            How much capability do you need?
          </h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {activePreset?.blurb ?? "Custom floor — set below."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Two named tiers for the two questions people actually arrive with;
              the slider underneath stays available for anything in between. */}
          <div className="seg" role="group" aria-label="Capability tier">
            {FLOOR_PRESETS.map((p) => (
              <button
                key={p.id}
                aria-pressed={activePreset?.id === p.id}
                onClick={() => onChange({ ...settings, floor: p.floor })}
              >
                {p.label} · {pct(p.floor, p.floor * 100 % 1 === 0 ? 0 : 1)}
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

      <div className="grid gap-5 sm:grid-cols-3">
        <Slider
          label="Capability floor"
          value={settings.floor}
          display={pct(settings.floor, 0)}
          min={0.1}
          max={0.75}
          step={0.01}
          onChange={(floor) => onChange({ ...settings, floor })}
          help="Minimum pass rate a model must hit to be considered at all. This is what stops cheap-but-unreliable models from winning on price."
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
          BangBuck = pass@1 ÷ (cost × tokens^{settings.beta.toFixed(2)} × steps^
          {settings.gamma.toFixed(2)})
        </span>
        , computed only for configs at or above the floor. Token and step penalties are relative to
        the leanest config in the set.
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
