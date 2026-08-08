import { ImageResponse } from "next/og";
import snapshot from "@/data/snapshot.json";
import { computeRanking, DEFAULT_SETTINGS } from "@/lib/score";
import type { Snapshot } from "@/lib/types";

/**
 * The link preview, generated from the ranking itself at build time.
 *
 * This site exists to be sent to someone, and a link with no card is a link
 * nobody opens. Rendering it from `computeRanking` rather than exporting a
 * static picture means the card can never disagree with the page — when the
 * answer changes, so does the preview, on the next build and with no separate
 * asset to remember to update.
 */
export const runtime = "nodejs";
export const alt = "BangBuck — the AI coding model with the most work per dollar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const ranking = computeRanking(snapshot as unknown as Snapshot, DEFAULT_SETTINGS);
  const w = ranking.insights?.winner;

  const pct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b0b0d",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          color: "#ffffff",
        }}
      >
        {/* A single accent hairline, echoing the answer card on the page. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "1200px",
            height: "6px",
            background: "#3987e5",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 24,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#898781",
            }}
          >
            BangBuck
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 82, fontWeight: 700, letterSpacing: "-0.025em" }}>
            Best code per dollar.
          </div>
        </div>

        {w ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 22, color: "#898781", letterSpacing: "0.1em" }}>
              BEST BANG FOR YOUR BUCK RIGHT NOW
            </div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 12 }}>
              <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "#3987e5", letterSpacing: "-0.02em" }}>
                {w.config.modelDisplay}
              </div>
              {w.config.effort && (
                <div style={{ display: "flex", marginLeft: 18, fontSize: 30, color: "#c3c2b7" }}>
                  {w.config.effort.toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ display: "flex", marginTop: 26, fontSize: 28, color: "#c3c2b7" }}>
              {pct(w.ship, 1)} of real repo tasks · {pct(w.craft ?? 0)} craft · $
              {w.config.meanCostUsd.toFixed(2)} per task
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 30, color: "#c3c2b7" }}>
            Ranked on measured cost, not list price.
          </div>
        )}

        <div style={{ display: "flex", fontSize: 22, color: "#898781" }}>
          {ranking.all.length} configurations · DeepSWE v1.1 + Arena WebDev · a model must finish the
          job and write code worth keeping
        </div>
      </div>
    ),
    size,
  );
}
