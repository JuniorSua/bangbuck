"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ranking, ScoredConfig } from "@/lib/score";
import { craftEloOf } from "@/lib/score";
import { pct, steps, tokens, usdPrecise } from "@/lib/format";
import { VendorMark } from "./VendorMark";

type SortKey = "bb" | "ship" | "craft" | "cost" | "tokens" | "steps";

/**
 * All 51 configs. Gated-out rows stay visible but dimmed rather than hidden —
 * seeing what got excluded, and by how little, is what makes the ranking
 * trustworthy rather than a black box. The specific value that failed is drawn in
 * the warning colour, so "why is this greyed out" is answerable at a glance.
 */
export function RankTable({ ranking }: { ranking: Ranking }) {
  const [sort, setSort] = useState<SortKey>("bb");
  const [desc, setDesc] = useState(true);
  const [query, setQuery] = useState("");
  // Mirrors the chart's Qualified/All switch: most readers only want the rows
  // that could actually be picked, and sixty-three dimmed ones bury them.
  const [scope, setScope] = useState<"qualified" | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Fifty-one rows is past the point where scanning works. The most common
   * question a returning reader has is not "what won" — the card above answers
   * that — but "where did MY model land", and until now the only way to answer
   * it was to read every row.
   *
   * Matches on model, effort and vendor together, so "anthropic", "opus", and
   * "xhigh" are all useful queries. Whitespace splits into terms that must all
   * match, which makes "opus max" work without needing to guess the exact label.
   */
  const filtered = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = scope === "qualified" ? ranking.qualified : ranking.all;
    if (!terms.length) return rows;
    return rows.filter((s) => {
      const hay = `${s.label} ${s.organization}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [ranking.all, ranking.qualified, query, scope]);

  // "/" focuses the filter, the convention every search-in-page UI shares. Only
  // when the reader is not already typing somewhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && el === inputRef.current) {
        setQuery("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sorted = [...filtered].sort((a, b) => {
    // Below-floor configs have no meaningful BB score, so keep them at the bottom
    // when sorting by it rather than interleaving nonsense.
    if (sort === "bb" && a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    const v = value(a, sort) - value(b, sort);
    return desc ? -v : v;
  });

  // The bars are drawn against the best score, not the widest visible one, so a
  // re-sort never rescales them and the winner's bar always reads as full.
  const topBb = Math.max(...ranking.qualified.map((s) => s.bb), 0);

  const toggle = (k: SortKey) => {
    if (k === sort) setDesc(!desc);
    else {
      setSort(k);
      setDesc(true);
    }
  };

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by model or vendor…"
            aria-label="Filter configurations by model or vendor"
            className="w-full rounded-xl border px-4 py-3 pr-9 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "rgba(255,255,255,0.03)",
              color: "var(--text-primary)",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear filter"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              ✕
            </button>
          )}
        </div>
        <div className="seg" role="group" aria-label="Rows shown">
          <button aria-pressed={scope === "qualified"} onClick={() => setScope("qualified")}>
            Qualified · {ranking.qualified.length}
          </button>
          <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>
            All · {ranking.all.length}
          </button>
        </div>
        {query && (
          <span className="tnum shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
            {sorted.length} match{sorted.length === 1 ? "" : "es"}
          </span>
        )}
        {!query && (
          <span
            className="ml-auto hidden shrink-0 items-center gap-1.5 text-xs sm:flex"
            style={{ color: "var(--text-muted)" }}
          >
            Press
            <kbd
              className="rounded border px-1.5 py-0.5 font-mono text-[10px]"
              style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.04)" }}
            >
              /
            </kbd>
            to filter
          </span>
        )}
      </div>

      {/* max-h + sticky thead: fifty rows is longer than any viewport, and a
          header that scrolls away turns the lower two-thirds into unlabelled
          numbers. */}
      <div className="card table-scroll max-h-[75vh]">
        <table className="w-full text-sm">
          <thead
            className="sticky top-0 z-10"
            style={{ background: "var(--surface-1)", boxShadow: "0 1px 0 0 var(--border)" }}
          >
            <tr>
              <Th>#</Th>
              <Th align="left">Model</Th>
              <Th sortable active={sort === "bb"} desc={desc} onClick={() => toggle("bb")}>
                BangBuck
              </Th>
              <Th sortable active={sort === "ship"} desc={desc} onClick={() => toggle("ship")}>
                Ship
              </Th>
              <Th sortable active={sort === "craft"} desc={desc} onClick={() => toggle("craft")}>
                Craft
              </Th>
              <Th sortable active={sort === "cost"} desc={desc} onClick={() => toggle("cost")}>
                Cost
              </Th>
              <Th sortable active={sort === "tokens"} desc={desc} onClick={() => toggle("tokens")} hideOnPhone>
                Out tok
              </Th>
              <Th sortable active={sort === "steps"} desc={desc} onClick={() => toggle("steps")} hideOnPhone>
                Steps
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <Row key={s.label} s={s} isWinner={s.rank === 1} topBb={topBb} />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  {query
                    ? <>Nothing matches &ldquo;{query}&rdquo;{scope === "qualified" ? " among qualifiers" : ""}. Try a vendor name, or part of a model name.</>
                    : "Nothing clears both floors. Lower a floor above."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="mt-3">
        <summary
          className="cursor-pointer select-none text-xs underline underline-offset-2"
          style={{ color: "var(--text-muted)" }}
        >
          How to read this table
        </summary>
        <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-secondary)" }}>Ship</strong> = share of 113 real repo
          tasks finished (DeepSWE). <strong style={{ color: "var(--text-secondary)" }}>Craft</strong>{" "}
          = estimated WebDev preference against the board median (Arena WebDev).{" "}
          <span className="font-mono">~</span> marks a craft score borrowed from the nearest sibling
          effort — Arena rates only{" "}
          {ranking.all.filter((s) => s.craftMatch.kind === "exact").length} of {ranking.all.length}{" "}
          configs directly. Dimmed rows failed a floor; the failing number is the amber one.
        </p>
      </details>
    </section>
  );
}

function Row({ s, isWinner, topBb }: { s: ScoredConfig; isWinner: boolean; topBb: number }) {
  const c = s.config;
  const dim = !s.qualified;
  return (
    <tr
      className="row border-b last:border-0"
      style={{
        borderColor: "var(--border)",
        opacity: dim ? 0.75 : 1,
        background: isWinner ? "rgba(57,135,229,0.08)" : undefined,
      }}
    >
      <td
        className="px-3 py-2.5 tnum text-xs"
        style={{ color: isWinner ? "var(--accent)" : "var(--text-muted)" }}
      >
        {s.rank ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <span className="flex items-center gap-2">
          {/* Vendor first, so the column can be scanned by company without
              reading a single model name. Inherits the row's colour. */}
          <span
            className="flex shrink-0 items-center"
            style={{ color: isWinner ? "var(--accent)" : "var(--text-muted)" }}
          >
            <VendorMark organization={s.organization} />
          </span>
          <span
            className="font-medium"
            style={{ color: isWinner ? "var(--accent)" : "var(--text-primary)" }}
          >
            {c.modelDisplay}
          </span>
          {c.effort && (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{ color: "var(--text-muted)" }}
            >
              {c.effort}
            </span>
          )}
        </span>
        <details className="row-details text-xs" style={{ color: "var(--text-secondary)" }}>
          <summary className="cursor-pointer" aria-label={`Details for ${s.label}`}>Details</summary>
          <div className="mt-2 space-y-1 whitespace-normal">
            <p>{s.failed === "unrated" ? "No voted WebDev rating" : s.failed
              ? `Below your ${s.failed === "both" ? "Ship and Craft floors" : `${s.failed} floor`}`
              : "Clears both floors by point estimate"}</p>
            <p>Ship 95% interval: {pct(c.ciLo, 1)}–{pct(c.ciHi, 1)}</p>
            {s.craftMatch.kind !== "none" && <p>
              Craft {s.craftMatch.kind === "family" ? "estimated from" : "matched directly to"} {s.craftMatch.entry.modelDisplayName}
            </p>}
            <p>{tokens(c.meanOutputTokens)} output tokens · {steps(c.meanAgentSteps)} agent steps</p>
          </div>
        </details>
      </td>
      {/* The number and its share of the best score, together. Fifty rows of
          bare figures do not rank themselves; a bar the eye can run down does
          the comparing before any of them are actually read. */}
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        <span
          className="tnum text-sm font-semibold"
          style={{ color: isWinner ? "var(--accent)" : "var(--text-secondary)" }}
        >
          {s.qualified ? s.bb.toFixed(2) : "—"}
        </span>
        <span
          className="mt-1 block h-[3px] overflow-hidden rounded-full"
          style={{ background: s.qualified ? "var(--baseline)" : "transparent" }}
          aria-hidden="true"
        >
          {s.qualified && topBb > 0 && (
            <span
              className="bb-bar"
              style={{
                // Rounded, and not only for tidiness. The browser truncates CSS
                // percentages when it parses them, so a raw float renders as
                // 73.54960673390156% on the client and reads back as 73.5496%
                // from the server's HTML — which React reports as a hydration
                // mismatch. Two decimals is already finer than a 116px bar can
                // draw.
                width: `${Math.max(2, (s.bb / topBb) * 100).toFixed(2)}%`,
                background: isWinner ? "var(--accent)" : "var(--text-muted)",
              }}
            />
          )}
        </span>
      </td>
      <Td warn={s.failed === "ship" || s.failed === "both"}>
        {pct(s.ship, 1)}
        <span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          ±{(((c.ciHi - c.ciLo) / 2) * 100).toFixed(0)}
        </span>
      </Td>
      <Td warn={s.failed === "craft" || s.failed === "both"}>
        {s.craft === null ? (
          "—"
        ) : (
          <span title={`${craftEloOf(s).toFixed(0)} Elo on Arena WebDev`}>
            {pct(s.craft, 0)}
            {s.craftMatch.kind === "family" && (
              <span
                className="ml-0.5 font-mono text-[10px]"
                style={{ color: "var(--text-muted)" }}
                title={`Borrowed from the ${s.craftMatch.borrowedFrom} variant — Arena does not rate this effort`}
              >
                ~
              </span>
            )}
          </span>
        )}
      </Td>
      <Td>{usdPrecise(c.meanCostUsd)}</Td>
      <Td hideOnPhone>{tokens(c.meanOutputTokens)}</Td>
      <Td hideOnPhone>{steps(c.meanAgentSteps)}</Td>
    </tr>
  );
}

function Th({
  children,
  align = "right",
  sortable,
  active,
  desc,
  onClick,
  hideOnPhone,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sortable?: boolean;
  hideOnPhone?: boolean;
  active?: boolean;
  desc?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      aria-sort={sortable ? active ? desc ? "descending" : "ascending" : "none" : undefined}
      className={`px-3 py-2.5 text-xs font-medium uppercase tracking-[0.08em] ${
        align === "left" ? "text-left" : "text-right"
      } ${hideOnPhone ? "hidden sm:table-cell" : ""}`}
      style={{ color: active ? "var(--text-secondary)" : "var(--text-muted)" }}
    >
      {sortable ? (
        <button onClick={onClick} className="hover:underline">
          {children}
          {active && <span className="ml-1">{desc ? "↓" : "↑"}</span>}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function Td({
  children,
  accent,
  bold,
  muted,
  warn,
  hideOnPhone,
}: {
  children: React.ReactNode;
  accent?: boolean;
  bold?: boolean;
  muted?: boolean;
  hideOnPhone?: boolean;
  /** This is the value that failed its floor — the reason the row is dimmed. */
  warn?: boolean;
}) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-2.5 text-right tnum ${bold ? "font-semibold" : ""} ${
        hideOnPhone ? "hidden sm:table-cell" : ""
      }`}
      style={{
        color: accent
          ? "var(--accent)"
          : warn
            ? "var(--warning)"
            : muted
              ? "var(--text-muted)"
              : "var(--text-secondary)",
      }}
    >
      {children}
    </td>
  );
}

function value(s: ScoredConfig, key: SortKey): number {
  switch (key) {
    case "bb":
      return s.qualified ? s.bb : -1;
    case "ship":
      return s.ship;
    case "craft":
      return s.craft ?? -1;
    case "cost":
      return s.config.meanCostUsd;
    case "tokens":
      return s.config.meanOutputTokens;
    case "steps":
      return s.config.meanAgentSteps;
  }
}
