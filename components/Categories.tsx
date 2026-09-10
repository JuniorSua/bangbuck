"use client";

import type { Category } from "@/lib/score";
import { VendorMark } from "./VendorMark";
import { CraftEvidence } from "./CraftEvidence";

/**
 * One line per axis, for readers whose priority is not "best value".
 *
 * The ranking answers a single question well. Someone who came for "cheapest
 * thing that actually works" or "which is fastest" previously had to sort the
 * fifty-row table and reason about the floors themselves. These are the direct
 * answers, all drawn from configs that already cleared both bars — so nothing
 * here recommends something that cannot do the job.
 *
 * The best-value winner usually takes several of these, and that repetition is
 * informative rather than redundant: when one config is cheapest AND leanest AND
 * fastest, the ranking is not a close call.
 */
export function Categories({ categories }: { categories: Category[] }) {
  if (!categories.length) return null;

  return (
    <div className="category-grid">
      {categories.map((c, i) => (
        <div key={c.id} className="card card-inset-hover category-card">
          <div className="flex flex-col items-start">
            <span
              className="text-sm font-medium"
              style={{ color: i === 0 ? "var(--accent)" : "var(--text-muted)" }}
            >
              {c.label}
            </span>
            <span
              className="category-value tnum"
              style={{ color: i === 0 ? "var(--accent)" : "var(--text-primary)" }}
            >
              {c.value}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="flex shrink-0 items-center" style={{ color: "var(--text-muted)" }}>
              <VendorMark organization={c.winner.organization} size={14} />
            </span>
            <span className="min-w-0 break-words text-base" style={{ color: "var(--text-primary)" }}>
              {c.tiedWith && c.tiedWith.length > 1 ? `${c.tiedWith.length} configurations tied` : c.winner.config.modelDisplay}
              {!(c.tiedWith && c.tiedWith.length > 1) && c.winner.config.effort && (
                <span
                  className="ml-2 text-xs uppercase tracking-[0.04em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {c.winner.config.effort}
                </span>
              )}
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {c.blurb}
          </p>
          {/* The one line that differs when a single config sweeps the board. */}
          {c.alternative && !(c.tiedWith && c.tiedWith.length > 1) && (
            <p className="category-alt tnum" style={{ color: "var(--text-muted)" }}>
              <span>Next model</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {c.alternative.config.config.modelDisplay}
                {c.alternative.config.config.effort && (
                  <span className="ml-1 text-[10px] uppercase tracking-[0.04em]">{c.alternative.config.config.effort}</span>
                )}
              </span>
              <span>{c.alternative.value}</span>
            </p>
          )}
          {c.tiedWith && c.tiedWith.length > 1 && (
            <details className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              <summary className="cursor-pointer">See tied configurations</summary>
              <ul className="mt-2 space-y-1">
                {c.tiedWith.map((s) => <li key={s.label}>{s.label}</li>)}
              </ul>
              <p className="mt-2">An inherited family rating does not establish differences between these efforts.</p>
            </details>
          )}
          {(c.id === "value" || c.id === "craft") && <CraftEvidence config={c.winner} compact />}
        </div>
      ))}
    </div>
  );
}
