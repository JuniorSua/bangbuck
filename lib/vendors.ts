/**
 * Canonical vendor identifiers, kept separate from the SVG that draws them so a
 * test can assert coverage without pulling JSX into the test runtime.
 *
 * These names are Arena's, not guesses. Two are genuinely not derivable from
 * the model prefix — grok ships under "SpaceXAI" and muse-spark under "Meta" —
 * which is exactly why this list is asserted against the data rather than
 * maintained by eye.
 */
export const VENDORS = [
  "Anthropic",
  "OpenAI",
  "Google",
  "Moonshot",
  "xAI",
  "Z.ai",
  "Meta",
  "Alibaba",
  "DeepSeek",
] as const;

export type Vendor = (typeof VENDORS)[number];

/** Alternate spellings seen in source data, mapped to the canonical name. */
export const VENDOR_ALIASES: Record<string, Vendor> = {
  SpaceXAI: "xAI",
  Muse: "Meta",
  Zhipu: "Z.ai",
  "Moonshot AI": "Moonshot",
  // Artificial Analysis spellings.
  "Z AI": "Z.ai",
  Kimi: "Moonshot",
};

/** Resolve any source-data organization string to a canonical vendor, or null. */
export function canonicalVendor(organization: string): Vendor | null {
  if ((VENDORS as readonly string[]).includes(organization)) return organization as Vendor;
  return VENDOR_ALIASES[organization] ?? null;
}
