"use client";

import type { Category } from "@/lib/score";
import { VendorMark } from "./VendorMark";

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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((c, i) => (
        <div key={c.id} className="card-inset card-inset-hover p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: i === 0 ? "var(--accent)" : "var(--text-muted)" }}
            >
              {c.label}
            </span>
            <span
              className="tnum text-sm font-semibold"
              style={{ color: i === 0 ? "var(--accent)" : "var(--text-primary)" }}
            >
              {c.value}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="flex shrink-0 items-center" style={{ color: "var(--text-muted)" }}>
              <VendorMark organization={c.winner.organization} size={14} />
            </span>
            <span className="truncate text-sm" style={{ color: "var(--text-primary)" }}>
              {c.winner.config.modelDisplay}
              {c.winner.config.effort && (
                <span
                  className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {c.winner.config.effort}
                </span>
              )}
            </span>
          </div>

          <p className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>
            {c.blurb}
          </p>
        </div>
      ))}
    </div>
  );
}
