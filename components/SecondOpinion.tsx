"use client";

import { aaFor, aaLeaders, aaRank } from "@/lib/aa";
import type { ScoredConfig } from "@/lib/score";
import type { AaData } from "@/lib/types";
import { VendorMark } from "./VendorMark";

/**
 * What Artificial Analysis — an independent lab with one shared test suite —
 * crowns on each axis it measures, next to today's pick here.
 *
 * Beside the ranking, never inside it: AA's cost per task covers science and
 * maths as well as code, so it cannot stand in for DeepSWE's cost per repo task.
 */
export function SecondOpinion({ aa, pick }: { aa: AaData; pick: ScoredConfig | undefined }) {
  const leaders = aaLeaders(aa);
  const mine = pick && aaFor(aa, pick.config.model, pick.config.effort);

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Artificial Analysis runs every model through the same tests and publishes score, cost and
        speed. It is shown beside the ranking, not inside it: its cost per task covers science and
        maths as well as code, so it cannot replace DeepSWE&apos;s cost per real repo task.
      </p>

      <div className="category-grid">
        {leaders.map((l) => (
          <div key={l.id} className="card card-inset-hover category-card">
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{l.label}</span>
              <span className="category-value tnum" style={{ color: "var(--text-primary)" }}>{l.value}</span>
            </div>
            <div className="flex items-center gap-2.5">
              {l.creator && (
                <span className="flex shrink-0 items-center" style={{ color: "var(--text-muted)" }}>
                  <VendorMark organization={l.creator} size={14} />
                </span>
              )}
              <span className="min-w-0 break-words text-base" style={{ color: "var(--text-primary)" }}>
                {l.name}
                {l.effort && <Effort effort={l.effort} />}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{l.blurb}</p>
            {l.next && (
              <p className="category-alt tnum" style={{ color: "var(--text-muted)" }}>
                <span>Next model</span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {l.next.name}
                  {l.next.effort && <span className="ml-1 text-[10px] uppercase tracking-[0.04em]">{l.next.effort}</span>}
                </span>
                <span>{l.next.value}</span>
              </p>
            )}
          </div>
        ))}
      </div>

      {pick && (
        <p className="max-w-2xl text-sm leading-relaxed tnum" style={{ color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-secondary)" }}>Today&apos;s pick here on the same tests.</strong>{" "}
          {mine ? (
            <>
              {pick.label} scores {mine.intelligence.toFixed(1)} on the Intelligence Index (#{aaRank(aa, mine)} of{" "}
              {aa.models.length})
              {mine.terminalBench !== null && <>, {(mine.terminalBench * 100).toFixed(1)}% on Terminal-Bench 4.0</>}
              {mine.costPerTask !== null && <>, at ${mine.costPerTask.toFixed(2)} per AA task</>}.
            </>
          ) : (
            <>Artificial Analysis has not published {pick.label}.</>
          )}
        </p>
      )}
    </div>
  );
}

function Effort({ effort }: { effort: string }) {
  return (
    <span className="ml-2 text-xs uppercase tracking-[0.04em]" style={{ color: "var(--text-muted)" }}>
      {effort}
    </span>
  );
}
