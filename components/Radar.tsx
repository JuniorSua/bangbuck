"use client";

import type { Contender, Settings } from "@/lib/score";
import { noteFor } from "@/lib/notes";
import { pct } from "@/lib/format";
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
  settings,
}: {
  contenders: Contender[];
  settings: Settings;
}) {
  if (!contenders.length) return null;

  return (
    <div className="space-y-3">
      <p className="max-w-2xl text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
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
          <div key={c.entry.modelDisplayName} className="card-inset p-4">
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
  );
}
