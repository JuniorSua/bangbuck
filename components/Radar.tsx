"use client";

import type { Contender, ScoredConfig, Settings } from "@/lib/score";
import { noteFor, type Release } from "@/lib/notes";
import { pct, usdPrecise, tokens as fmtTokens } from "@/lib/format";
import { canonicalVendor } from "@/lib/vendors";
import { VendorMark } from "./VendorMark";

/**
 * Models Arena rates well that the ranking cannot touch.
 *
 * Without this the site quietly lies by omission. A reader who has just seen
 * qwen3.8-max enter Arena's WebDev board at #4 and does not find it here would
 * reasonably conclude the ranking had judged it and found it wanting. It has
 * not: DeepSWE never measured it, so there is no Ship score and — more
 * decisively — no measured cost per task to divide by. List price per million
 * tokens cannot stand in, because it says nothing about how many tokens a model
 * burns finishing a real repo task.
 *
 * So they get a place, with the reason stated and no score invented for them.
 */
export function Radar({
  contenders,
  measured,
  releases,
  measuredPotential,
  settings,
}: {
  contenders: Contender[];
  /** Configs DeepSWE ran that Arena has never rated — the opposite gap. */
  measured: ScoredConfig[];
  /** Launched too recently for either source; no data at all yet. */
  releases: Release[];
  /** What each would score at exactly the reader's Craft floor, by label. */
  measuredPotential: Map<string, number>;
  settings: Settings;
}) {
  if (!contenders.length && !measured.length && !releases.length) return null;

  const winnerBb = measuredPotential.get("__winner__") ?? 0;

  return (
    <div className="space-y-10">
      {releases.length > 0 && (
        <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-secondary)" }}>Too new to measure.</strong>{" "}
          {releases.map((r, i) => (
            <span key={r.model}>
              {i > 0 && ", "}
              <a
                href={r.source}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
                style={{ color: "var(--text-secondary)" }}
              >
                {r.model}
              </a>
            </span>
          ))}{" "}
          are out, but neither DeepSWE nor Arena WebDev has measured them yet, so there is no Ship, Craft
          or cost per task to rank.
        </p>
      )}
      {measured.length > 0 && (
        <div className="space-y-5">
          <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text-secondary)" }}>Measured, but not rated.</strong>{" "}
            DeepSWE has run these — real pass rate, real cost, real tokens and steps — but Arena has
            published no voted family rating, so there is no Craft score and no ranking. The expensive half of
            the data exists; one human-preference rating is all that is missing.
          </p>

          {measured.map((s) => {
            const potential = measuredPotential.get(s.label);
            const passesShip = s.ship >= settings.shipFloor;
            const beatsWinner = passesShip && potential !== undefined && winnerBb > 0 && potential > winnerBb;
            return (
              <div key={s.label} className="card-inset p-7">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="flex items-center gap-2">
                    <span className="flex shrink-0 items-center" style={{ color: "var(--text-secondary)" }}>
                      <VendorMark organization={s.organization} size={14} />
                    </span>
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {s.config.modelDisplay}
                      {s.config.effort && (
                        <span
                          className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {s.config.effort}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="tnum ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
                    ship <strong style={{ color: "var(--text-secondary)" }}>{pct(s.ship, 1)}</strong>{" "}
                    · craft <strong style={{ color: "var(--warning)" }}>unrated</strong> ·{" "}
                    {usdPrecise(s.config.meanCostUsd)}/task · {fmtTokens(s.config.meanOutputTokens)} ·{" "}
                    {s.config.meanAgentSteps.toFixed(0)} steps
                  </span>
                </div>

                {/* The honest floor of its potential: what it would score if its
                    craft came in at the WORST passing grade. "Even at the
                    minimum" is a claim the data supports; a flattering guess
                    would not be. */}
                {!passesShip && <p className="mt-2 text-sm" style={{ color: "var(--warning)" }}>
                  Below your {pct(settings.shipFloor, 1)} Ship floor; a Craft rating alone cannot qualify it.
                </p>}
                {passesShip && potential !== undefined && (
                  <div
                    className="mt-2.5 flex flex-wrap items-baseline gap-x-2 border-t pt-2.5 text-xs"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{
                        background: beatsWinner
                          ? "rgba(57,135,229,0.16)"
                          : "rgba(255,255,255,0.06)",
                        color: beatsWinner ? "var(--accent)" : "var(--text-muted)",
                      }}
                    >
                      If rated
                    </span>
                    <span className="tnum" style={{ color: "var(--text-secondary)" }}>
                      BangBuck {potential.toFixed(2)} at a bare {pct(settings.craftFloor, 0)} craft
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {beatsWinner
                        ? `— that alone would beat today's winner by ${(potential / winnerBb).toFixed(2)}x`
                        : "— not enough to take the crown even so"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {contenders.length > 0 && (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Rated at or above your {pct(settings.craftFloor, 0)} Craft floor by Arena, but never run by
        DeepSWE. They cannot be ranked here — not because they lost, but because the formula divides
        by <em>measured</em> cost per task and nobody has measured theirs. List price is shown for
        scale only; it is not what the ranking uses.
      </p>

      {contenders.map((c) => {
        const note = noteFor(c.entry.modelDisplayName);
        const vendor = c.entry.organization;
        const failsShip =
          note?.claimedShip !== undefined && note.claimedShip < settings.shipFloor;

        return (
          <div key={c.entry.modelDisplayName} className="card-inset p-7">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="flex items-center gap-2">
                <span className="flex shrink-0 items-center" style={{ color: "var(--text-secondary)" }}>
                  <VendorMark organization={vendor ?? ""} size={14} />
                </span>
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {c.entry.modelDisplayName}
                </span>
              </span>
              {vendor && canonicalVendor(vendor) && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {vendor}
                </span>
              )}
              <span
                className="tnum ml-auto text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                WebDev #{c.rank} · craft{" "}
                <strong style={{ color: "var(--text-secondary)" }}>{pct(c.craft, 0)}</strong> ·{" "}
                {c.entry.votes.toLocaleString()} votes
                {c.entry.inputPricePerMillion !== null && (
                  <> · ${c.entry.inputPricePerMillion}/${c.entry.outputPricePerMillion} per M</>
                )}
              </span>
            </div>

            {note && (
              <p className="mt-2.5 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {note.note}{" "}
                <a
                  href={note.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {note.sourceLabel} ↗
                </a>
              </p>
            )}

            {/* The claim gets its own row and its own warning colour, so it can
                never be mistaken for one of the measured figures above it. */}
            {note?.claimedShip !== undefined && (
              <div
                className="mt-2.5 flex flex-wrap items-baseline gap-x-2 border-t pt-2.5 text-xs"
                style={{ borderColor: "var(--border)" }}
              >
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                  style={{ background: "rgba(250,178,25,0.14)", color: "var(--warning)" }}
                >
                  {note.selfReported ? "Self-reported" : "Third party"}
                </span>
                <span className="tnum" style={{ color: "var(--text-secondary)" }}>
                  Ship {pct(note.claimedShip, 1)} on DeepSWE v1.1
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  {failsShip
                    ? `— under your ${pct(settings.shipFloor, 1)} floor by ${(
                        (settings.shipFloor - note.claimedShip) *
                        100
                      ).toFixed(1)} points, so it would be gated out on its own numbers`
                    : "— clears your Ship floor, but there is still no measured cost to rank it on"}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
      )}
    </div>
  );
}
