import { canonicalVendor } from "@/lib/vendors";

/**
 * Small vendor marks, so a reader can scan the table by company before reading
 * a single model name.
 *
 * These are simplified geometric renderings drawn here, NOT official brand
 * assets — nothing is copied from or hotlinked to a vendor's site or to
 * DeepSWE's icon directory. They are deliberately simple: at 14px a faithful
 * logo turns to mush, and a shape that reads instantly beats one that is
 * technically accurate but illegible.
 *
 * They inherit `currentColor` rather than carrying vendor colours. Colour on
 * this site is reserved for the podium, and seven more hues would both break
 * that and fail colourblind separation. Shape distinguishes the company; the
 * model name right beside it removes any ambiguity.
 */
const MARKS: Record<string, { title: string; paths: React.ReactNode }> = {
  Anthropic: {
    title: "Anthropic",
    // Angular "A".
    paths: (
      <path
        d="M8 1.9 13.6 14.1 H11 L9.9 11.5 H6.1 L5 14.1 H2.4 Z M7 9.3 H9 L8 6.7 Z"
        fill="currentColor"
      />
    ),
  },
  OpenAI: {
    title: "OpenAI",
    // Hexagonal knot, reduced to nested hexagons.
    paths: (
      <>
        <path
          d="M8 1.6 13.6 4.8 V11.2 L8 14.4 2.4 11.2 V4.8 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M8 5.4 10.3 6.7 V9.3 L8 10.6 5.7 9.3 V6.7 Z" fill="currentColor" />
      </>
    ),
  },
  Google: {
    title: "Google",
    // "G": open ring plus the crossbar.
    paths: (
      <>
        <path
          d="M13 5.4 A5.6 5.6 0 1 0 13.4 9.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path d="M8.4 7.6 H13.8 V9.6 H8.4 Z" fill="currentColor" />
      </>
    ),
  },
  Moonshot: {
    title: "Moonshot",
    // Crescent.
    paths: (
      <path
        d="M11.4 2.3 A6.3 6.3 0 1 0 11.4 13.7 A5.1 5.1 0 1 1 11.4 2.3 Z"
        fill="currentColor"
      />
    ),
  },
  xAI: {
    title: "xAI",
    paths: (
      <path
        d="M3.4 3.4 12.6 12.6 M12.6 3.4 3.4 12.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    ),
  },
  "Z.ai": {
    title: "Z.ai",
    paths: (
      <path
        d="M3.6 3.7 H12.4 L3.6 12.3 H12.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    ),
  },
  Meta: {
    title: "Meta",
    // Infinity loop.
    paths: (
      <path
        d="M2.3 8 C2.3 5.7 3.6 4.5 5 4.5 C7.2 4.5 8 8 8 8 C8 8 8.8 11.5 11 11.5 C12.4 11.5 13.7 10.3 13.7 8 C13.7 5.7 12.4 4.5 11 4.5 C8.8 4.5 8 8 8 8 C8 8 7.2 11.5 5 11.5 C3.6 11.5 2.3 10.3 2.3 8 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    ),
  },
};

const UNKNOWN = {
  title: "Unknown vendor",
  paths: (
    <circle cx="8" cy="8" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
  ),
};

export function VendorMark({
  organization,
  size = 14,
  className,
}: {
  organization: string;
  size?: number;
  className?: string;
}) {
  const vendor = canonicalVendor(organization);
  const mark = (vendor && MARKS[vendor]) ?? UNKNOWN;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      role="img"
      aria-label={mark.title}
    >
      <title>{mark.title}</title>
      {mark.paths}
    </svg>
  );
}
