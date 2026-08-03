"use client";

import { useEffect, useRef, useState } from "react";
import type { Ranking } from "@/lib/score";
import { pct, usdPrecise } from "@/lib/format";
import { VendorMark } from "./VendorMark";

/**
 * A thin bar that carries the answer once the card holding it has scrolled away.
 *
 * The page is about 5,600px tall and every section below the first is a reason
 * to change your mind about the answer — the floors, the chart, the fifty rows.
 * Reading any of them meant losing the thing they are arguments about, and
 * scrolling back to check. This keeps it in view for the cost of 44 pixels.
 *
 * Visibility is driven by an IntersectionObserver on the winner card rather than
 * a scroll handler: no listener firing on every frame, and it stays correct when
 * the layout reflows or a setting change resizes the card.
 */
export function StickyAnswer({
  ranking,
  watch,
}: {
  ranking: Ranking;
  /** The element whose disappearance reveals the bar. */
  watch: React.RefObject<HTMLElement | null>;
}) {
  const [shown, setShown] = useState(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = watch.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting), {
      // Fire once the card is fully past the top, not as it starts to leave.
      rootMargin: "-72px 0px 0px 0px",
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [watch]);

  const w = ranking.insights?.winner;
  if (!w) return null;

  return (
    <div
      aria-hidden={!shown}
      className="pointer-events-none fixed inset-x-0 top-0 z-30"
      style={{
        transform: shown ? "translateY(0)" : "translateY(-100%)",
        opacity: shown ? 1 : 0,
        transition: "transform 260ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease",
      }}
    >
      <div
        className="border-b"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--page) 82%, transparent)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-2.5">
          <span
            className="hidden shrink-0 text-[10px] uppercase tracking-[0.12em] sm:inline"
            style={{ color: "var(--text-muted)" }}
          >
            Best value
          </span>
          <span
            className="flex shrink-0 items-center"
            style={{ color: "var(--accent)" }}
            aria-hidden="true"
          >
            <VendorMark organization={w.organization} size={14} />
          </span>
          <span className="truncate text-sm font-medium" style={{ color: "var(--accent)" }}>
            {w.config.modelDisplay}
            {w.config.effort && (
              <span
                className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: "var(--text-muted)" }}
              >
                {w.config.effort}
              </span>
            )}
          </span>

          <span className="ml-auto flex shrink-0 items-center gap-3 tnum text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="hidden sm:inline">
              ship {pct(w.ship, 1)} · craft {pct(w.craft ?? 0, 0)}
            </span>
            <span>{usdPrecise(w.config.meanCostUsd)}/task</span>
            <span
              className="rounded px-1.5 py-0.5 font-semibold"
              style={{ background: "rgba(57,135,229,0.14)", color: "var(--accent)" }}
            >
              {w.bb.toFixed(2)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
