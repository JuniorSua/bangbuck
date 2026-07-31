export const pct = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}%`;

export const usd = (v: number) => (v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(2)}`);

/** Costs span $0.01 to $26 — small ones need the extra digit to stay distinguishable. */
export const usdPrecise = (v: number) => (v < 0.1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`);

export const tokens = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : String(Math.round(v));

export const steps = (v: number) => v.toFixed(0);

/** Keep one decimal well past 10× — "19.5× cheaper" is a headline claim and
 *  rounding it to "20×" reads as sloppy next to the exact percentages beside it. */
export const multiple = (v: number) => (v >= 100 ? `${v.toFixed(0)}×` : `${v.toFixed(1)}×`);

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
